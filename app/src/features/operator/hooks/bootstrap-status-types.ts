// Type surface for the bootstrap-status hook + view.

export type BootstrapSection =
  | 'Identity'
  | 'Calendars'
  | 'Lifecycle'
  | 'Factories'
  | 'Cash & oracle'

export interface BootstrapRow {
  key: string
  section: BootstrapSection
  label: string
  count: number
  /** Minimum count required for this row to read as ok. Defaults to 1. */
  minExpected: number
  ok: boolean
  loading: boolean
  /** Pre-encoded /ledger query string fragment (just the filter value). */
  ledgerTemplateFilter: string
  /** First on-chain contract id for this row's template, when present.
   *  Bootstrap-status-card uses this to deep-link the /ledger drawer
   *  for the specific contract instead of just the template prefix. */
  contractId: string | null
}

export interface UseBootstrapStatusResult {
  sections: { name: BootstrapSection; rows: BootstrapRow[] }[]
  totalRows: number
  totalOk: number
  allOk: boolean
  anyLoading: boolean
}

export interface CalendarPayload {
  calendar: { id: string }
}

export interface LifecycleRulePayload {
  id: { unpack: string }
  lifecycler: string
}
