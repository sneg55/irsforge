'use client'

import { useQuery } from '@tanstack/react-query'
import { decodeMark } from '@/features/csa/decode'
import { useLedgerClient } from '@/shared/hooks/use-ledger-client'
import { hintFromParty } from '@/shared/ledger/party-match'
import { pollIntervalWithBackoff } from '@/shared/ledger/poll-interval'
import { MARK_TEMPLATE_ID } from '@/shared/ledger/template-ids'
import type { ContractResult, MarkToMarketPayload } from '@/shared/ledger/types'

const REFETCH_MS = 5_000

/**
 * Latest signed MTM per (partyA, partyB) pair, keyed by hint-pair so the
 * regulator's oversight page can render an at-a-glance MTM column without
 * each row re-running the trader's full pricing pipeline. Audit E5 — the
 * regulator's canonical surface had no valuation; this is the cheapest
 * useful number to add since the CSA mark already lives on chain.
 *
 * Key shape: `${hintA}|${hintB}` where hintA / hintB are the bare party
 * hints (no fingerprint). Caller looks up via the same hint pair derived
 * from the workflow row's parties.
 *
 * Returns `null` from `forPair` when no mark exists yet for that pair.
 */
export interface UseAllMarksByPairResult {
  forPair: (partyA: string, partyB: string) => { exposure: number; asOf: string } | null
  isLoading: boolean
}

function pairKey(a: string, b: string): string {
  return `${hintFromParty(a)}|${hintFromParty(b)}`
}

export function useAllMarksByPair(): UseAllMarksByPairResult {
  const { client, activeParty } = useLedgerClient()
  const query = useQuery({
    queryKey: ['regulator', 'marks-by-pair', activeParty],
    queryFn: async () => {
      if (!client) return new Map<string, { exposure: number; asOf: string }>()
      const rows = await client.query<ContractResult<MarkToMarketPayload>>(MARK_TEMPLATE_ID)
      const out = new Map<string, { exposure: number; asOf: string }>()
      for (const r of rows) {
        const m = decodeMark(r.contractId, r.payload)
        const k = pairKey(m.partyA, m.partyB)
        const prev = out.get(k)
        if (!prev || m.asOf > prev.asOf) out.set(k, { exposure: m.exposure, asOf: m.asOf })
        // CSA pair orientation is canonicalised across surfaces, but two
        // marks could land on opposite-orientation pair keys during a
        // demo restart — index both directions so the lookup is order-
        // tolerant for the regulator caller, which doesn't know which
        // side the original CSA proposed from.
        const kFlip = pairKey(m.partyB, m.partyA)
        if (!out.has(kFlip)) out.set(kFlip, { exposure: -m.exposure, asOf: m.asOf })
      }
      return out
    },
    enabled: !!client,
    refetchInterval: pollIntervalWithBackoff(REFETCH_MS),
  })
  const data = query.data ?? new Map<string, { exposure: number; asOf: string }>()
  return {
    forPair: (a: string, b: string) => data.get(pairKey(a, b)) ?? null,
    isLoading: query.isLoading,
  }
}
