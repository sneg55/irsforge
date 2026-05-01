'use client'

import { useQuery } from '@tanstack/react-query'
import { useLedger } from '@/shared/contexts/ledger-context'
import { FLOATING_RATE_INDEX_TEMPLATE_ID } from './template-ids'
import type { ContractResult } from './types'

/**
 * Parsed shape returned by `useFloatingRateIndex`. `lookback` is exposed
 * as a number (business-day count) and `floor` as a nullable number —
 * the on-chain payload keeps these as Daml `Int` / `Decimal` which
 * arrive over JSON as strings.
 */
export interface FloatingRateIndexData {
  indexId: string
  currency: string
  family: string
  compounding: string
  lookback: number
  floor: number | null
}

interface IndexPayload {
  indexId: string
  currency: string
  family: string
  compounding: string
  lookback: string
  floor: string | null
}

function toIndex(p: IndexPayload): FloatingRateIndexData {
  return {
    indexId: p.indexId,
    currency: p.currency,
    family: p.family,
    compounding: p.compounding,
    lookback: parseInt(p.lookback, 10),
    floor: p.floor !== null ? parseFloat(p.floor) : null,
  }
}

/**
 * React Query hook that reads the on-chain `FloatingRateIndex` contract
 * for a given `indexId` (e.g. `"USD-SOFR-COMPOUND"`). Returns `null` when
 * no matching index has been registered yet — consumers should treat
 * that as "not available", not as an error.
 *
 * Invalidation is keyed on `client?.authToken` (same rationale as
 * `useCurve` — `useLedger()` does not currently expose a post-action
 * refetch nonce).
 */
export function useFloatingRateIndex(indexId: string) {
  const { client } = useLedger()

  return useQuery<FloatingRateIndexData | null>({
    queryKey: ['floating-rate-index', indexId, client?.authToken],
    queryFn: async () => {
      if (!client) return null
      const results = await client.query<ContractResult<IndexPayload>>(
        FLOATING_RATE_INDEX_TEMPLATE_ID,
      )
      const match = results.find((r) => r.payload.indexId === indexId)
      if (!match) return null
      return toIndex(match.payload)
    },
    enabled: !!client && !!indexId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}

/**
 * Returns all registered `FloatingRateIndex` contracts so UIs can offer
 * a discoverable picker rather than a free-text input.
 */
export function useFloatingRateIndices() {
  const { client } = useLedger()

  return useQuery<FloatingRateIndexData[]>({
    queryKey: ['floating-rate-indices', client?.authToken],
    queryFn: async () => {
      if (!client) return []
      const results = await client.query<ContractResult<IndexPayload>>(
        FLOATING_RATE_INDEX_TEMPLATE_ID,
      )
      return results.map((r) => toIndex(r.payload))
    },
    enabled: !!client,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}
