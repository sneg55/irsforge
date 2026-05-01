'use client'

import { useQueries } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { LedgerClient } from '@/shared/ledger/client'
import type {
  AssetInstrumentPayload,
  CcyInstrumentPayload,
  CdsInstrumentPayload,
  FpmlInstrumentPayload,
  FxInstrumentPayload,
  IrsInstrumentPayload,
  SwapInstrumentPayload,
} from '@/shared/ledger/swap-instrument-types'
import { SWAP_INSTRUMENT_TEMPLATE_BY_TYPE } from '@/shared/ledger/template-ids'
import type { ContractResult } from '@/shared/ledger/types'

// Matches SwapWorkflow.swapType values on-chain (see
// contracts/src/Swap/Workflow.daml). IRS + OIS share the InterestRate
// template; BASIS + XCCY + FpML share the Fpml template — the map in
// SWAP_INSTRUMENT_TEMPLATE_BY_TYPE enforces the routing.
export type SwapFamily = 'IRS' | 'OIS' | 'BASIS' | 'XCCY' | 'CDS' | 'CCY' | 'FX' | 'ASSET' | 'FpML'

type RawPayload =
  | IrsInstrumentPayload
  | CdsInstrumentPayload
  | CcyInstrumentPayload
  | FxInstrumentPayload
  | AssetInstrumentPayload
  | FpmlInstrumentPayload

/**
 * Batched per-family fetch of on-chain swap instruments, indexed by
 * instrument.id.unpack so the blotter / pricer can resolve a workflow's
 * economics in O(1) without an extra round-trip per row.
 *
 * - Empty `families`  → no queries fire; returns empty map.
 * - Null `client`     → no queries fire; returns empty map.
 * - 3-second refetch matches the blotter's existing cadence.
 *
 * Phase 2 (instrument-as-source-of-truth) Stage B, Task 6.
 */
export function useSwapInstruments(
  client: LedgerClient | null,
  families: SwapFamily[],
): {
  byInstrumentId: Map<string, SwapInstrumentPayload>
  isLoading: boolean
} {
  const queries = useQueries({
    queries: families.map((family) => ({
      queryKey: ['swap-instrument', family] as const,
      enabled: !!client,
      refetchInterval: 3000,
      queryFn: async (): Promise<ContractResult<RawPayload>[]> => {
        if (!client) return []
        return await client.query<ContractResult<RawPayload>>(
          SWAP_INSTRUMENT_TEMPLATE_BY_TYPE[family],
        )
      },
    })),
  })

  // React Query with `enabled: false` puts queries in status:'pending' but
  // fetchStatus:'idle'. The naive `q.isLoading` would report true forever for
  // a null client or empty families, so we guard with fetchStatus !== 'idle'.
  const isLoading = queries.some((q) => q.isLoading && q.fetchStatus !== 'idle')

  const byInstrumentId = useMemo(() => {
    const map = new Map<string, SwapInstrumentPayload>()
    queries.forEach((q, i) => {
      const family = families[i]
      const rows = q.data ?? []
      for (const r of rows) {
        // Cast is safe by construction: SWAP_INSTRUMENT_TEMPLATE_BY_TYPE[family]
        // returns the template for this family's payload variant.
        // The Daml Finance V0 swap-instrument templates flatten InstrumentKey
        // fields onto the template (no `instrument: InstrumentKey` wrapper) —
        // see the docstring on swap-instrument-types.ts. Read `id.unpack`
        // directly off the payload, NOT off `payload.instrument.id.unpack`.
        map.set(r.payload.id.unpack, {
          swapType: family,
          payload: r.payload,
        } as SwapInstrumentPayload)
      }
    })
    return map
    // dataUpdatedAt changes on new data → rebuild map; same timestamps → same reference.
  }, [queries.map((q) => q.dataUpdatedAt).join(','), families.join(',')])

  return { byInstrumentId, isLoading }
}
