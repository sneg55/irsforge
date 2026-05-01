'use client'

import { useCurve } from '@/shared/ledger/useCurve'
import { type CurveSource, OracleUnavailableError } from './oracle-errors'

export type { CurveSource }
export { OracleUnavailableError }

/**
 * Thin wrapper over `useCurve('USD', 'Discount')`. Preserves the public API
 * (`{ curve, isLoading, source, error }`) that existing consumers depend on,
 * while the underlying data source is the on-chain `Curve` contract — not
 * `RateObservation`s assembled client-side, and no HTTP fallback to the
 * oracle service's `/api/rates` endpoint.
 */
export function useOracleCurve() {
  const { data: curve, isLoading, error } = useCurve('USD', 'Discount')

  const unavailable = !!error || (!isLoading && !curve)

  return {
    curve: curve ?? null,
    isLoading,
    source: (unavailable ? 'unavailable' : 'ledger') as CurveSource,
    error: error instanceof Error ? error : null,
  }
}
