'use client'

import { useEffect, useRef, useState } from 'react'
import { resolveStreamUrl } from '../config/client'
import { useLedger } from '../contexts/ledger-context'

export interface StreamedEventsOptions {
  templateIds: string[]
  onCreated: (payload: unknown, contractId: string, templateId: string) => void
  onArchived: (contractId: string, templateId: string) => void
  enabled: boolean
  onError?: (error: Error) => void
}

type Status = 'idle' | 'connecting' | 'open' | 'closed' | 'fallback'

// Retry policy: time-budgeted, not attempt-counted. See
// use-streamed-contracts.ts for the rationale (graceful demo-restart
// recovery without an F5).
const RETRY_BUDGET_MS = 90_000
const BASE_BACKOFF_MS = 100
const MAX_BACKOFF_MS = 10_000

function backoffDelay(attempt: number): number {
  const base = BASE_BACKOFF_MS * 2 ** (attempt - 1)
  const jitter = 1 + (Math.random() - 0.5) * 0.5
  return Math.min(MAX_BACKOFF_MS, Math.max(50, Math.round(base * jitter)))
}

export function useStreamedEvents(opts: StreamedEventsOptions): {
  status: Status
  lastError: Error | null
} {
  const { client, activeOrg } = useLedger()
  const [status, setStatus] = useState<Status>('idle')
  const [lastError, setLastError] = useState<Error | null>(null)
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryCount = useRef(0)
  // First-failure timestamp in the current disconnection cycle. Reset
  // on every successful onopen so each independent outage gets a fresh
  // budget rather than a single global one.
  const retryStartedAt = useRef<number | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  const templatesKey = opts.templateIds.join('|')

  // Stable primitives to avoid spurious re-mounts when context returns new refs.
  const authToken = client?.authToken ?? null
  const streamBase = activeOrg ? (activeOrg.streamUrl ?? activeOrg.ledgerUrl) : null
  const orgId = activeOrg?.id ?? null

  useEffect(() => {
    if (!opts.enabled || !client || !activeOrg || opts.templateIds.length === 0) {
      setStatus('idle')
      return
    }
    let cancelled = false

    const open = () => {
      if (cancelled) return
      let url: string
      try {
        url = `${resolveStreamUrl(activeOrg)}/v1/stream/query`
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err))
        setLastError(e)
        opts.onError?.(e)
        setStatus('fallback')
        return
      }
      setStatus('connecting')

      const ws = new WebSocket(url, [`jwt.token.${client.authToken}`, 'daml.ws.auth'])
      wsRef.current = ws

      ws.onopen = () => {
        if (cancelled) return
        setStatus('open')
        retryCount.current = 0
        retryStartedAt.current = null
        ws.send(JSON.stringify([{ templateIds: opts.templateIds }]))
      }

      ws.onmessage = (ev) => {
        if (cancelled) return
        let msg: unknown
        try {
          msg = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data))
        } catch {
          // silent-ok: malformed/keep-alive frames are expected; drop quietly
          return
        }
        if (!msg || typeof msg !== 'object') return
        const events = (
          msg as {
            events?: Array<
              | { created?: { contractId: string; payload: unknown; templateId?: string } }
              | { archived?: { contractId: string; templateId?: string } }
            >
          }
        ).events
        if (!Array.isArray(events)) return
        for (const e of events) {
          if ('created' in e && e.created) {
            const t = e.created.templateId ?? opts.templateIds[0] ?? 'unknown'
            opts.onCreated(e.created.payload, e.created.contractId, t)
          } else if ('archived' in e && e.archived) {
            const t = e.archived.templateId ?? opts.templateIds[0] ?? 'unknown'
            opts.onArchived(e.archived.contractId, t)
          }
        }
      }

      ws.onerror = () => {
        if (cancelled) return
        const e = new Error(`WebSocket error on ${url}`)
        setLastError(e)
        opts.onError?.(e)
      }

      ws.onclose = (ev) => {
        if (cancelled) return
        if (ev.wasClean) {
          setStatus('closed')
          return
        }
        if (retryStartedAt.current === null) {
          retryStartedAt.current = Date.now()
        }
        const elapsed = Date.now() - retryStartedAt.current
        if (elapsed >= RETRY_BUDGET_MS) {
          setStatus('fallback')
          return
        }
        retryCount.current += 1
        retryTimer.current = setTimeout(open, backoffDelay(retryCount.current))
      }
    }

    open()

    return () => {
      cancelled = true
      if (retryTimer.current) clearTimeout(retryTimer.current)
      wsRef.current?.close()
    }
  }, [opts.enabled, templatesKey, authToken, streamBase, orgId])

  return { status, lastError }
}
