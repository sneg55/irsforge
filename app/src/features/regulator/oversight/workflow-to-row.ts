import { getInstrumentCurrency } from '@/shared/ledger/instrument-helpers'
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
  createdAtMs: number | null
  cid: string
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
    createdAtMs: null,
    cid: c.contractId,
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
    createdAtMs: null,
    cid: c.contractId,
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
    createdAtMs: null,
    cid: c.contractId,
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
  }
  const explicit =
    payload.currency ?? payload.baseCurrency ?? payload.fixedCurrency ?? payload.legs?.[0]?.currency
  return {
    id: p.contractId,
    partyA: p.proposer,
    partyB: p.counterparty,
    family: p.family,
    notional: payload.notional ? Number.parseFloat(payload.notional) : null,
    currency: explicit ?? (IMPLICIT_USD_FAMILIES.has(p.family) ? 'USD' : ''),
    status: 'Proposed',
    createdAtMs: null,
    cid: p.contractId,
  }
}
