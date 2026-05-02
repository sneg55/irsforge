'use client'

import { useQuery } from '@tanstack/react-query'
import { useCallback, useRef, useState } from 'react'
import { useLedgerClient } from '@/shared/hooks/use-ledger-client'
import { type StreamPhase, streamPhase } from '@/shared/hooks/use-stream-phase'
import { useStreamedContracts } from '@/shared/hooks/use-streamed-contracts'
import { pollIntervalWithBackoff } from '@/shared/ledger/poll-interval'
import { MARK_TEMPLATE_ID } from '@/shared/ledger/template-ids'
import type { ContractResult, MarkToMarketPayload } from '@/shared/ledger/types'
import { decodeMark, type MarkViewModel } from '../decode'

const DEFAULT_CAPACITY = 512
const POLL_INTERVAL_MS = 10_000

export type MarkStreamStatus = 'idle' | 'connecting' | 'open' | 'fallback'

export interface MarkStreamReturn {
  latest: MarkViewModel | null
  history: MarkViewModel[]
  status: MarkStreamStatus
  phase: StreamPhase
}

/**
 * Subscribe to MarkToMarket creates for a specific CSA pair.
 *
 * Filters on `(partyA, partyB)` rather than `csaCid`. The Mark template
 * stores `csaCid` as a stringified contract ID captured at PublishMark
 * time, but every PublishMark/SettleVm archives the previous Csa and
 * creates a new one — so that back-reference goes stale after the first
 * settle. The party pair is the stable identity of the CSA across its
 * contract-id lineage.
 */
export function useMarkStream(
  partyA: string | null,
  partyB: string | null,
  capacity: number = DEFAULT_CAPACITY,
): MarkStreamReturn {
  const { client } = useLedgerClient()
  const [history, setHistory] = useState<MarkViewModel[]>([])
  const [fallback, setFallback] = useState(false)
  const seenContractIds = useRef<Set<string>>(new Set())

  const push = useCallback(
    (m: MarkViewModel) => {
      setHistory((prev) => {
        const next = [...prev, m]
        return next.length > capacity ? next.slice(next.length - capacity) : next
      })
    },
    [capacity],
  )

  const enabled = !!client && !!partyA && !!partyB

  const { status } = useStreamedContracts<MarkToMarketPayload>({
    templateId: MARK_TEMPLATE_ID,
    enabled: enabled && !fallback,
    onCreated: (payload, cid) => {
      if (seenContractIds.current.has(cid)) return
      if (!partyA || !partyB) return
      if (payload.partyA !== partyA || payload.partyB !== partyB) return
      seenContractIds.current.add(cid)
      push(decodeMark(cid, payload))
    },
    onClose: () => setFallback(true),
  })

  useQuery({
    queryKey: ['mark-stream-poll', partyA, partyB, client?.authToken],
    queryFn: async () => {
      if (!client || !partyA || !partyB) return null
      const results = await client.query<ContractResult<MarkToMarketPayload>>(MARK_TEMPLATE_ID)
      for (const r of results) {
        if (seenContractIds.current.has(r.contractId)) continue
        if (r.payload.partyA !== partyA || r.payload.partyB !== partyB) continue
        seenContractIds.current.add(r.contractId)
        push(decodeMark(r.contractId, r.payload))
      }
      return null
    },
    enabled: enabled && fallback,
    refetchInterval: pollIntervalWithBackoff(POLL_INTERVAL_MS),
    refetchOnWindowFocus: false,
  })

  const latest = history.length > 0 ? history[history.length - 1] : null
  const effectiveStatus: MarkStreamStatus = fallback
    ? 'fallback'
    : status === 'closed'
      ? 'idle'
      : status
  const phase = streamPhase(effectiveStatus, history.length > 0)
  return { latest, history, status: effectiveStatus, phase }
}
