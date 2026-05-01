import type { SwapType } from '@irsforge/shared-pricing'
import type { CsaState } from '@/shared/ledger/types'

export type { SwapType }

export type BlotterTab = 'active' | 'proposals' | 'drafts' | 'matured' | 'unwound'

export interface SwapRow {
  contractId: string
  type: SwapType
  counterparty: string
  notional: number
  currency: string
  /** Effective / trade date string from the instrument's periodicSchedule. */
  tradeDate: string
  maturity: string
  npv: number | null
  dv01: number | null
  status: 'Active' | 'UnwindPending' | 'Proposed' | 'Draft' | 'Matured' | 'Unwound'
  direction: 'pay' | 'receive'
  /** One-line leg sketch (e.g. `Fixed 4.25% / SOFR`) used as a subtitle in
   *  the DIRECTION column so a buyer reads the trade shape without
   *  drilling into the workspace. Empty for FX. */
  legDetail?: string
  /** True when maturity falls inside a short window (default 7d). Drives
   *  the "MAT SOON" sub-status badge in the STATUS column. */
  maturingSoon?: boolean
  /** NPV series over the last N curve-stream ticks. Active rows only. */
  sparkline?: number[]
  // Terminal rows only
  terminalDate?: string
  terminalAmount?: number
  // Drawer-only (not rendered as columns)
  reason?: string
  terminatedByParty?: string
  settleBatchCid?: string | null
  /** Present on Active rows that have an outstanding TerminateProposal.
   *  role === 'proposer': active party proposed (waiting on cpty → amber).
   *  role === 'counterparty': cpty proposed (active party must respond → red). */
  pendingUnwind?: {
    role: 'proposer' | 'counterparty'
    proposalCid: string
  }
}

export interface ExposureSummary {
  totalNotional: number
  activeSwaps: number
  netExposure: number
  pendingProposals: number
  csaCount: number
  csaConfigured: boolean
  /** Σ collateral posted by the active party across visible CSAs. */
  csaOwnPosted: number
  /** Σ collateral posted by counterparties across visible CSAs. */
  csaCptyPosted: number
  /** Σ signed latest-mark exposure across visible CSAs, from the active
   *  party's perspective. `null` when any CSA lacks a published mark. */
  csaExposure: number | null
  /** Worst on-chain CSA state across the set. */
  csaState: CsaState
  /** Deduped regulator hints across the active party's CSAs. */
  csaRegulatorHints: string[]
  swapCountByType: Record<string, number>
  /** Σ NPV across active rows; null per-row values treated as 0. */
  bookNpv: number
  /** Σ DV01 across active rows; null per-row values treated as 0. */
  bookDv01: number
}
