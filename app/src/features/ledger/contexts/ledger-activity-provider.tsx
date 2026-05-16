'use client'

import { createContext, type ReactNode, useContext, useMemo } from 'react'
import { type StreamPhase, streamPhase } from '@/shared/hooks/use-stream-phase'
import { useStreamedEvents } from '@/shared/hooks/use-streamed-events'
import { DEFAULT_STREAM_TEMPLATES } from '../constants'
import { type LedgerActivityEvent, useLedgerActivityBuffer } from '../hooks/use-ledger-activity'
import { useLedgerActivityHttpSeed } from '../hooks/use-ledger-activity-http-seed'
import { partyFromPayload } from '../utils'

interface LedgerActivityContextValue {
  events: LedgerActivityEvent[]
  enabled: boolean
  denyPrefixes: readonly string[]
  allowPrefixes: readonly string[]
  systemPrefixes: readonly string[]
  phase: StreamPhase
}

const LedgerActivityContext = createContext<LedgerActivityContextValue | null>(null)

interface ProviderProps {
  enabled: boolean
  bufferSize: number
  templateFilter: {
    allow: readonly string[]
    deny: readonly string[]
    systemPrefixes?: readonly string[]
  }
  // Optional localStorage key the underlying buffer round-trips through so
  // the activity stream survives a tab reload. Threaded down from the org
  // shell so different orgs don't share a buffer; when omitted, the ring
  // is in-memory only (the prior shape).
  persistKey?: string
  children: ReactNode
}

export function LedgerActivityProvider({
  enabled,
  bufferSize,
  templateFilter,
  persistKey,
  children,
}: ProviderProps) {
  const buffer = useLedgerActivityBuffer({ bufferSize, persistKey })

  // Subscription templates: allow=[] uses the default set. Denylist is applied
  // client-side after receipt (Canton cannot filter by prefix at subscription).
  const templateIds = useMemo(() => {
    if (templateFilter.allow.length > 0) return [...templateFilter.allow]
    return DEFAULT_STREAM_TEMPLATES
  }, [templateFilter.allow])

  const push = buffer.push

  const { status } = useStreamedEvents({
    templateIds,
    enabled,
    onCreated: (payload, contractId, templateId) => {
      push({
        kind: 'create',
        templateId,
        contractId,
        party: partyFromPayload(payload),
        ts: Date.now(),
        payload,
      })
    },
    onArchived: (contractId, templateId) => {
      // Canton archive events carry no payload, so the party column for
      // archives stays `—` unless an earlier create for the same cid is
      // still in the buffer (the drawer correlates via cid).
      push({ kind: 'archive', templateId, contractId, party: null, ts: Date.now() })
    },
  })

  // HTTP-poll seed: covers JWT profiles where /v1/stream/query yields an
  // empty active set even though /v1/query for the same templates returns
  // rows (regulator demo profile is the known case — see audit A3). Buffer
  // dedup-on-(kind,cid) makes this safe to run alongside WS.
  useLedgerActivityHttpSeed({ templateIds, enabled, push })

  const systemPrefixes = templateFilter.systemPrefixes ?? []
  const phase: StreamPhase = streamPhase(status, buffer.events.length > 0)

  const value = useMemo<LedgerActivityContextValue>(
    () => ({
      events: buffer.events,
      enabled,
      denyPrefixes: templateFilter.deny,
      allowPrefixes: templateFilter.allow,
      systemPrefixes,
      phase,
    }),
    [buffer.events, enabled, templateFilter.deny, templateFilter.allow, systemPrefixes, phase],
  )

  return <LedgerActivityContext.Provider value={value}>{children}</LedgerActivityContext.Provider>
}

export function useLedgerActivityContext(): LedgerActivityContextValue {
  const ctx = useContext(LedgerActivityContext)
  if (!ctx) {
    throw new Error('useLedgerActivityContext must be called inside a <LedgerActivityProvider>')
  }
  return ctx
}
