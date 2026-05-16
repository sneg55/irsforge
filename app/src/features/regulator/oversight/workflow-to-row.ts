import { getInstrumentCurrency, getInstrumentTradeDate } from '@/shared/ledger/instrument-helpers'
import type { SwapInstrumentPayload } from '@/shared/ledger/swap-instrument-types'
import type {
  ContractResult,
  MaturedSwap,
  SwapWorkflow,
  TerminatedSwap,
} from '@/shared/ledger/types'
import type { CrossOrgProposalRow, SwapFamily } from '../hooks/use-all-proposals-cross-org'

export type OversightStatus = 'Proposed' | 'Live' | 'Matured' | 'Terminated'

export interface OversightRow {
  id: string
  partyA: string
  partyB: string
  family: SwapFamily
  notional: number | null
  currency: string
  status: OversightStatus
  // ISO-date-parsed epoch ms used as the deterministic sort key inside each
  // status bucket. Semantics by status:
  //   Live      → instrument effective (trade) date
  //   Proposed  → proposal startDate (or firstPaymentDate for FX)
  //   Matured   → actualMaturityDate (instant the workflow matured)
  //   Terminated→ terminationDate (instant the workflow was terminated)
  // null means the relevant date string was missing/unparseable — those rows
  // sort to the bottom of their bucket.
  sortDateMs: number | null
  createdAtMs: number | null
  cid: string
  // Latest pair-level MTM from the on-chain Csa.Mark stream, signed from
  // partyA's perspective. Same number across every Live row in the same
  // pair (audit E5 — first cut surfaces pair MTM; per-trade NPV would
  // need the regulator to replicate the trader's pricing pipeline). Null
  // when no mark exists yet, when the row isn't a Live workflow (terminal
  // and proposed states have no MTM), or when the mark stream hasn't
  // loaded yet.
  latestMtm: number | null
}

function parseIsoDateMs(s: string | undefined | null): number | null {
  if (!s) return null
  // Daml emits dates as bare ISO 'YYYY-MM-DD'. Date.parse() reads those as
  // UTC midnight which is what we want for a deterministic sort key —
  // timezone of the viewer doesn't matter because every row uses the same
  // parser.
  const n = Date.parse(s)
  return Number.isNaN(n) ? null : n
}

function normaliseFamily(s: string): SwapFamily {
  if (s === 'FPML') return 'FpML'
  return s as SwapFamily
}

function currencyForWorkflow(
  instrumentId: string,
  byInstrumentId: Map<string, SwapInstrumentPayload>,
): string {
  const instr = byInstrumentId.get(instrumentId)
  // getInstrumentCurrency returns 'USD' as a documented loading placeholder
  // when instr is undefined — flatten that to '—' for the regulator view so
  // the column reads honestly while the instrument query is in flight.
  if (!instr) return ''
  return getInstrumentCurrency(instr)
}

function tradeDateMsForInstrument(
  instrumentId: string,
  byInstrumentId: Map<string, SwapInstrumentPayload>,
): number | null {
  const instr = byInstrumentId.get(instrumentId)
  if (!instr) return null
  const s = getInstrumentTradeDate(instr)
  return parseIsoDateMs(s)
}

export function workflowToRow(
  c: ContractResult<SwapWorkflow>,
  byInstrumentId: Map<string, SwapInstrumentPayload>,
): OversightRow {
  return {
    id: c.contractId,
    partyA: c.payload.partyA,
    partyB: c.payload.partyB,
    family: normaliseFamily(c.payload.swapType),
    notional: c.payload.notional ? Number.parseFloat(c.payload.notional) : null,
    currency: currencyForWorkflow(c.payload.instrumentKey.id.unpack, byInstrumentId),
    status: 'Live',
    sortDateMs: tradeDateMsForInstrument(c.payload.instrumentKey.id.unpack, byInstrumentId),
    createdAtMs: null,
    cid: c.contractId,
    latestMtm: null,
  }
}

export function maturedToRow(
  c: ContractResult<MaturedSwap>,
  byInstrumentId: Map<string, SwapInstrumentPayload>,
): OversightRow {
  return {
    id: c.contractId,
    partyA: c.payload.partyA,
    partyB: c.payload.partyB,
    family: normaliseFamily(c.payload.swapType),
    notional: c.payload.notional ? Number.parseFloat(c.payload.notional) : null,
    currency: currencyForWorkflow(c.payload.instrumentKey.id.unpack, byInstrumentId),
    status: 'Matured',
    // For terminal states, sort on the lifecycle date (when it matured), not
    // the effective date — that's what a regulator scrubbing recent activity
    // wants at the top.
    sortDateMs: parseIsoDateMs(c.payload.actualMaturityDate),
    createdAtMs: null,
    cid: c.contractId,
    latestMtm: null,
  }
}

export function terminatedToRow(
  c: ContractResult<TerminatedSwap>,
  byInstrumentId: Map<string, SwapInstrumentPayload>,
): OversightRow {
  return {
    id: c.contractId,
    partyA: c.payload.partyA,
    partyB: c.payload.partyB,
    family: normaliseFamily(c.payload.swapType),
    notional: c.payload.notional ? Number.parseFloat(c.payload.notional) : null,
    currency: currencyForWorkflow(c.payload.instrumentKey.id.unpack, byInstrumentId),
    status: 'Terminated',
    sortDateMs: parseIsoDateMs(c.payload.terminationDate),
    createdAtMs: null,
    cid: c.contractId,
    latestMtm: null,
  }
}

// Single-currency proposal families that don't carry an explicit currency on
// the proposal payload — the rate index dictates the currency at accept-time.
// All four are USD-only by convention in IRSForge (USD-SOFR/USD-EFFR rate
// families and the USD CDS reference data); show 'USD' rather than '—' so
// the column is informative for the dominant case. If the demo adds non-USD
// IRS/OIS/CDS/ASSET this will need a deeper resolution off the rate family.
const IMPLICIT_USD_FAMILIES: ReadonlySet<SwapFamily> = new Set(['IRS', 'OIS', 'CDS', 'ASSET'])

export function proposalToRow(p: CrossOrgProposalRow): OversightRow {
  const payload = p.payload as {
    notional?: string
    currency?: string
    baseCurrency?: string
    fixedCurrency?: string
    legs?: { currency?: string }[]
    startDate?: string
    firstPaymentDate?: string
  }
  const explicit =
    payload.currency ?? payload.baseCurrency ?? payload.fixedCurrency ?? payload.legs?.[0]?.currency
  // FX is the one family without `startDate` — its first-cashflow analog is
  // `firstPaymentDate`. Every other proposal type carries `startDate`.
  const dateStr = payload.startDate ?? payload.firstPaymentDate
  return {
    id: p.contractId,
    partyA: p.proposer,
    partyB: p.counterparty,
    family: p.family,
    notional: payload.notional ? Number.parseFloat(payload.notional) : null,
    currency: explicit ?? (IMPLICIT_USD_FAMILIES.has(p.family) ? 'USD' : ''),
    status: 'Proposed',
    sortDateMs: parseIsoDateMs(dateStr),
    createdAtMs: null,
    cid: p.contractId,
    latestMtm: null,
  }
}
