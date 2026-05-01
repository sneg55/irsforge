import type { SwapInstrumentPayload } from '@/shared/ledger/swap-instrument-types'
import type { ObservablesConfig, SwapType } from '../types'

/**
 * Pure resolver: given a swap's type + on-chain instrument + the
 * `ObservablesConfig` from `/api/config`, return the list of
 * `Observation.id.unpack` values whose contracts must be fetched and passed
 * as `observableCids` to `Swap.Workflow:TriggerLifecycle`.
 *
 * Phase 2: the instrument carries rate ids verbatim (no string templating for
 * CDS). IRS still consults `observables.IRS.rateIds` as the authoritative
 * list; ASSET still uses `observables.ASSET.rateIdPattern` + `enabled` gate.
 *
 *   IRS   → static list from config (currently `["SOFR/ON"]`);
 *           falls back to config list when `instr` is null (loading guard)
 *   CDS   → `defaultProbabilityReferenceId` + `recoveryRateReferenceId`
 *           read directly off the instrument — no pattern templating
 *   CCY   → none (embedded fixed/floating rates, no oracle lookup)
 *   FX    → none (self-contained forward points)
 *   ASSET → per-asset ids from `underlyings[].referenceAssetId` via
 *           `observables.ASSET.rateIdPattern`, but only when `enabled=true`
 *   FpML  → none (rates embedded in legs)
 */
export function resolveRateIdsForSwap(
  swapType: SwapType,
  instr: SwapInstrumentPayload | null,
  observables: ObservablesConfig,
): string[] {
  switch (swapType) {
    case 'IRS':
    case 'OIS':
    case 'BASIS':
    case 'XCCY':
      // OIS reuses the IRS instrument template; BASIS/XCCY will too once
      // their stages ship. All four derive the rate id from the on-chain
      // instrument's FloatingRate.referenceRateId the same way.
      // Fallback to config list when instr is null (instrument not yet loaded).
      if (instr && instr.swapType === 'IRS') {
        return [instr.payload.floatingRate.referenceRateId]
      }
      return [...observables.IRS.rateIds]

    case 'CDS': {
      if (!instr || instr.swapType !== 'CDS') return []
      // Rate ids are stored verbatim on the instrument — no templating needed.
      return [instr.payload.defaultProbabilityReferenceId, instr.payload.recoveryRateReferenceId]
    }

    case 'CCY':
      return []

    case 'FX':
      return []

    case 'ASSET': {
      if (!observables.ASSET.enabled) return []
      if (!instr || instr.swapType !== 'ASSET') return []
      const pattern = observables.ASSET.rateIdPattern
      return instr.payload.underlyings.map((u) => pattern.replace('{assetId}', u.referenceAssetId))
    }

    case 'FpML':
      return []

    default: {
      // Exhaustiveness check.
      const _exhaustive: never = swapType
      return _exhaustive
    }
  }
}
