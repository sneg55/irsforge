'use client'

import { useCallback, useRef } from 'react'
import type { DraftSummary, SwapConfig, SwapType } from '../types'

const DRAFT_PREFIX = 'irsforge:draft:'

// JSON.stringify invokes Date.prototype.toJSON *before* calling the replacer,
// so a `value instanceof Date` check in the replacer is always false. Read the
// pre-toJSON value off the holder (`this[key]`) instead.
// eslint-disable-next-line security/detect-unsafe-regex -- linear ISO-8601 anchored pattern, no nested quantifier
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/

interface DraftEntry {
  readonly config: string
  readonly type: SwapType
  readonly lastModified: number
  readonly notional: number
}

function serializeConfig(config: SwapConfig): string {
  return JSON.stringify(config, function reviveDates(this: Record<string, unknown>, key, value) {
    const raw = this[key]
    if (raw instanceof Date) return { __date: raw.toISOString() }
    return value as unknown
  })
}

function deserializeConfig(json: string): SwapConfig {
  return JSON.parse(json, (key: string, value: unknown) => {
    // The reviver visits leaves first, so when the outer `{__date: ...}` is
    // visited its inner ISO string has already been turned into a Date by the
    // back-compat branch below. Accept either form here.
    if (value && typeof value === 'object' && '__date' in value) {
      const d = value.__date
      if (d instanceof Date) return d
      if (typeof d === 'string') return new Date(d)
    }
    // Back-compat: drafts saved before the replacer fix stored Dates as bare
    // ISO strings. Revive them so existing localStorage entries still load.
    // Skip the `__date` key itself so the wrapper branch above can use it.
    if (key !== '__date' && typeof value === 'string' && ISO_DATE_RE.test(value)) {
      return new Date(value)
    }
    return value
  }) as SwapConfig
}

export function useDrafts() {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const saveDraft = useCallback((draftId: string, config: SwapConfig) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      const entry = {
        config: serializeConfig(config),
        type: config.type,
        lastModified: Date.now(),
        notional: getNotional(config),
      }
      localStorage.setItem(DRAFT_PREFIX + draftId, JSON.stringify(entry))
    }, 500) // debounce 500ms
  }, [])

  const loadDraft = useCallback((draftId: string): SwapConfig | null => {
    const raw = localStorage.getItem(DRAFT_PREFIX + draftId)
    if (!raw) return null
    try {
      const entry = JSON.parse(raw) as DraftEntry
      return deserializeConfig(entry.config)
    } catch {
      return null
    }
  }, [])

  const listDrafts = useCallback((): DraftSummary[] => {
    const drafts: DraftSummary[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(DRAFT_PREFIX)) continue
      try {
        const raw = localStorage.getItem(key)
        if (!raw) continue
        const entry = JSON.parse(raw) as DraftEntry
        drafts.push({
          draftId: key.slice(DRAFT_PREFIX.length),
          type: entry.type,
          lastModified: entry.lastModified,
          notional: entry.notional,
        })
      } catch {
        /* skip corrupted entries */
      }
    }
    return drafts.sort((a, b) => b.lastModified - a.lastModified)
  }, [])

  const deleteDraft = useCallback((draftId: string) => {
    localStorage.removeItem(DRAFT_PREFIX + draftId)
  }, [])

  const deleteAllDrafts = useCallback(() => {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(DRAFT_PREFIX)) keys.push(key)
    }
    for (const key of keys) localStorage.removeItem(key)
  }, [])

  const generateDraftId = useCallback((): string => {
    return crypto.randomUUID()
  }, [])

  return { saveDraft, loadDraft, listDrafts, deleteDraft, deleteAllDrafts, generateDraftId }
}

function getNotional(config: SwapConfig): number {
  const firstLeg = config.legs[0]
  if (!firstLeg) return 0
  if ('notional' in firstLeg) return firstLeg.notional
  return 0
}
