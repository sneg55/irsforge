import type { CsaState } from '@/shared/ledger/types'

export type CsaStatusKind = 'healthy' | 'warn' | 'call' | 'disputed' | 'escalated' | 'unknown'

export interface ExposureHeaderData {
  bookNpv: number
  bookDv01: number
  totalNotional: number
  activeSwaps: number
  swapCountByType: Record<string, number>
  /** Curve revaluation timestamp (ISO). Stamped under BOOK RISK / BOOK SIZE
   *  so a buyer can read freshness without hunting in the footer. */
  asOf?: string | null
  csa: {
    configured: boolean
    ownPosted: number
    cptyPosted: number
    /** Signed from active party's perspective; null when no mark yet. */
    exposure: number | null
    state: CsaState
    /** Hints (e.g. `RegulatorEU`) of every regulator party observing at
     *  least one of the active party's CSAs. Empty when none. */
    regulatorHints: string[]
  }
}
