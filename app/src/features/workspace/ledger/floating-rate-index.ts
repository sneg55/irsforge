import type { LedgerClient } from '@/shared/ledger/client'
import { FLOATING_RATE_INDEX_TEMPLATE_ID } from '@/shared/ledger/template-ids'
import type { LegConfig } from '../types'

/**
 * Resolve a FloatingRateIndex ContractId for the given currency. The oracle
 * seeds one contract per YAML-configured index at startup; we pick the first
 * match for `currency`. Throws if none is seeded — that's an operator
 * misconfiguration, not a recoverable runtime state.
 */
export async function resolveFloatingRateIndexCid(
  client: LedgerClient,
  currency: string,
): Promise<string> {
  const results = await client.query<{ contractId: string; payload: { currency?: string } }>(
    FLOATING_RATE_INDEX_TEMPLATE_ID,
  )
  const match = results.find((r) => r.payload?.currency === currency)
  if (!match) {
    throw new Error(
      `No FloatingRateIndex seeded for ${currency}. ` +
        `Check oracle startup logs and irsforge.yaml.floatingRateIndices.`,
    )
  }
  return match.contractId
}

/**
 * Resolve a FloatingRateIndex ContractId by its registry key (e.g. `USD-SOFR`,
 * `USD-EFFR`). BasisSwap Accept needs two specific indices, so currency-only
 * lookup is not enough — `indexId` disambiguates.
 */
export async function resolveFloatingRateIndexCidByIndexId(
  client: LedgerClient,
  indexId: string,
): Promise<string> {
  const results = await client.query<{ contractId: string; payload: { indexId?: string } }>(
    FLOATING_RATE_INDEX_TEMPLATE_ID,
  )
  const match = results.find((r) => r.payload?.indexId === indexId)
  if (!match) {
    throw new Error(
      `No FloatingRateIndex seeded with indexId="${indexId}". ` +
        `Check oracle startup logs and irsforge.yaml.floatingRateIndices.`,
    )
  }
  return match.contractId
}

export function getLegIndexId(legs: LegConfig[], legIndex: number): string | undefined {
  const leg = legs[legIndex]
  if (leg && 'indexId' in leg && typeof leg.indexId === 'string') return leg.indexId
  return undefined
}
