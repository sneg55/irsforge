import type { CsaSummary } from '@/features/csa/hooks/use-csa-summary'
import type { ExposureSummary, SwapRow } from './types'

export const EMPTY_CSA_SUMMARY: CsaSummary = {
  count: 0,
  configured: false,
  ownPosted: 0,
  cptyPosted: 0,
  exposure: null,
  state: 'Active',
  regulatorHints: [],
  phase: 'initial',
  isFetching: false,
  isdaMasterAgreementRef: '',
  governingLaw: 'NewYork',
  imAmount: 0,
  valuationCcy: '',
}

export const EMPTY_SUMMARY: ExposureSummary = {
  totalNotional: 0,
  activeSwaps: 0,
  netExposure: 0,
  pendingProposals: 0,
  csaCount: 0,
  csaConfigured: false,
  csaOwnPosted: 0,
  csaCptyPosted: 0,
  csaExposure: null,
  csaState: 'Active',
  csaRegulatorHints: [],
  swapCountByType: {},
  bookNpv: 0,
  bookDv01: 0,
}

/**
 * Aggregate blotter rows into the header-card summary.
 *
 * Notional and exposure reflect live risk only (active swaps). Proposals
 * are capital at intent, not at risk, so they're counted separately via
 * `pendingProposals` and don't contribute to `totalNotional` or
 * `netExposure` — prevents the "Active Swaps 0 / Net Exposure $80M"
 * contradiction in the UI.
 *
 * The CSA summary is passed in and threaded through unchanged. `useCsaSummary`
 * computes per-party posting and pulls the latest mark; keeping
 * `computeSummary` pure over (rows, csa summary) avoids pulling N
 * subscriptions into the blotter.
 */
export function computeSummary(
  activeRows: SwapRow[],
  proposalRows: SwapRow[],
  csa: CsaSummary,
): ExposureSummary {
  const swapCountByType: Record<string, number> = {}
  for (const row of activeRows) {
    swapCountByType[row.type] = (swapCountByType[row.type] ?? 0) + 1
  }
  return {
    totalNotional: activeRows.reduce((sum, r) => sum + r.notional, 0),
    activeSwaps: activeRows.length,
    netExposure: activeRows.reduce(
      (sum, r) => sum + (r.direction === 'pay' ? -r.notional : r.notional),
      0,
    ),
    pendingProposals: proposalRows.length,
    csaCount: csa.count,
    csaConfigured: csa.configured,
    csaOwnPosted: csa.ownPosted,
    csaCptyPosted: csa.cptyPosted,
    csaExposure: csa.exposure,
    csaState: csa.state,
    csaRegulatorHints: csa.regulatorHints,
    swapCountByType,
    bookNpv: activeRows.reduce((sum, r) => sum + (r.npv ?? 0), 0),
    bookDv01: activeRows.reduce((sum, r) => sum + (r.dv01 ?? 0), 0),
  }
}
