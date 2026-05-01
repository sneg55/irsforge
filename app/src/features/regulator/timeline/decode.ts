import type { LedgerActivityEvent } from '@/features/ledger/types'
import { PROPOSAL_TEMPLATES } from '@/features/workspace/hooks/build-proposal-payload'
import type { DisputeRecordPayload } from '@/shared/ledger/types'
import type { SwapFamily } from '../hooks/use-all-proposals-cross-org'
import type { BusinessEvent } from './business-events'

/**
 * Pure mapper from a raw LedgerActivityEvent (template + payload + ts) to a
 * BusinessEvent variant the regulator timeline renders. Returns null for
 * any event that isn't part of the regulator narrative — the caller drops
 * nulls when piping the buffer through.
 *
 * Mostly handles `create` events. The one `archive` case is the
 * `Csa.Dispute:DisputeRecord` archive, which yields `DisputeResolved` —
 * the resolution kind is read from `e.choice` (the exercising choice name)
 * when the upstream stream plumbs it; absent that, it falls back to
 * `'operator-ack'`. Real Canton archive notifications via WebSocket do
 * not currently carry the exercising choice — that fallback is the
 * production path. Unit tests pass `choice` directly on the fixture.
 *
 * Distinguishing TradeAccepted from TradeWithdrawn requires correlating
 * proposal-archive with SwapWorkflow-create, which this decoder does not
 * do — see followups.md.
 */
export function decode(e: LedgerActivityEvent): BusinessEvent | null {
  const tail = e.templateId.split(':').slice(-2).join(':')

  // DisputeRecord archive → DisputeResolved (the only archive event we
  // handle). Everything else short-circuits on non-create below.
  if (e.kind === 'archive' && tail === 'Csa.Dispute:DisputeRecord') {
    const resolution: 'agreed' | 'operator-ack' =
      e.choice === 'AgreeToCounterMark' ? 'agreed' : 'operator-ack'
    const p = e.payload as { partyA?: string; partyB?: string } | undefined
    return {
      kind: 'DisputeResolved',
      partyA: p?.partyA ?? '',
      partyB: p?.partyB ?? '',
      resolution,
      cid: e.contractId,
      ts: e.ts,
    }
  }

  if (e.kind !== 'create') return null

  // Proposal templates → TradeProposed
  const proposalFamily = PROPOSAL_TAIL_TO_FAMILY[tail]
  if (proposalFamily) {
    const p = e.payload as { proposer?: string; counterparty?: string } | undefined
    if (!p?.proposer || !p?.counterparty) return null
    return {
      kind: 'TradeProposed',
      family: proposalFamily,
      proposer: p.proposer,
      counterparty: p.counterparty,
      cid: e.contractId,
      ts: e.ts,
    }
  }

  if (tail === 'Swap.Workflow:SwapWorkflow') {
    const p = e.payload as
      | { swapType?: string; partyA?: string; partyB?: string; notional?: string }
      | undefined
    if (!p?.partyA || !p?.partyB || !p?.swapType) return null
    return {
      kind: 'TradeAccepted',
      family: normaliseFamily(p.swapType),
      partyA: p.partyA,
      partyB: p.partyB,
      notional: p.notional ? Number.parseFloat(p.notional) : 0,
      cid: e.contractId,
      ts: e.ts,
    }
  }

  if (tail === 'Swap.Workflow:MaturedSwap') {
    const p = e.payload as { swapType?: string; partyA?: string; partyB?: string } | undefined
    if (!p?.partyA || !p?.partyB || !p?.swapType) return null
    return {
      kind: 'TradeMatured',
      family: normaliseFamily(p.swapType),
      partyA: p.partyA,
      partyB: p.partyB,
      cid: e.contractId,
      ts: e.ts,
    }
  }

  if (tail === 'Swap.Terminate:TerminatedSwap') {
    const p = e.payload as { swapType?: string; partyA?: string; partyB?: string } | undefined
    if (!p?.partyA || !p?.partyB || !p?.swapType) return null
    return {
      kind: 'TradeTerminated',
      family: normaliseFamily(p.swapType),
      partyA: p.partyA,
      partyB: p.partyB,
      cid: e.contractId,
      ts: e.ts,
    }
  }

  if (tail === 'Csa.Csa:Csa') {
    const p = e.payload as
      | { partyA?: string; partyB?: string; valuationCcy?: string; state?: string }
      | undefined
    if (!p?.partyA || !p?.partyB || !p?.state) return null
    if (p.state === 'Escalated') {
      return {
        kind: 'DisputeEscalated',
        partyA: p.partyA,
        partyB: p.partyB,
        cid: e.contractId,
        ts: e.ts,
      }
    }
    if (p.state === 'MarginCallOutstanding') {
      return {
        kind: 'MarginCalled',
        partyA: p.partyA,
        partyB: p.partyB,
        ccy: p.valuationCcy ?? '',
        cid: e.contractId,
        ts: e.ts,
      }
    }
    if (p.state === 'Active') {
      return {
        kind: 'CsaPublished',
        partyA: p.partyA,
        partyB: p.partyB,
        ccy: p.valuationCcy ?? '',
        state: 'Active',
        cid: e.contractId,
        ts: e.ts,
      }
    }
    return null
  }

  if (tail === 'Csa.Dispute:DisputeRecord') {
    const p = e.payload as DisputeRecordPayload | undefined
    if (!p?.partyA || !p?.partyB || !p?.disputer) return null
    return {
      kind: 'DisputeOpened',
      partyA: p.partyA,
      partyB: p.partyB,
      disputer: p.disputer,
      reason: p.reason,
      counterMark: p.counterMark ? Number.parseFloat(p.counterMark) : 0,
      notes: p.notes ?? '',
      cid: e.contractId,
      ts: e.ts,
    }
  }

  if (tail === 'Csa.Mark:MarkToMarket') {
    const p = e.payload as
      | { partyA?: string; partyB?: string; asOf?: string; exposure?: string }
      | undefined
    if (!p?.partyA || !p?.partyB) return null
    return {
      kind: 'MarkPosted',
      partyA: p.partyA,
      partyB: p.partyB,
      exposure: p.exposure ? Number.parseFloat(p.exposure) : 0,
      asOf: p.asOf ?? '',
      cid: e.contractId,
      ts: e.ts,
    }
  }

  if (tail === 'Audit.SettlementAudit:SettlementAudit') {
    const p = e.payload as
      | {
          source?: string
          payer?: string
          payee?: string
          ccy?: string
          amount?: string
          sourceCid?: string
        }
      | undefined
    if (!p?.payer || !p?.payee || !p?.ccy) return null
    const source = p.source as 'swap-settle' | 'swap-mature' | 'csa-net' | undefined
    if (source !== 'swap-settle' && source !== 'swap-mature' && source !== 'csa-net') return null
    return {
      kind: 'SettlementAudited',
      source,
      payer: p.payer,
      payee: p.payee,
      ccy: p.ccy,
      amount: p.amount ? Number.parseFloat(p.amount) : 0,
      sourceCid: p.sourceCid ?? '',
      cid: e.contractId,
      ts: e.ts,
    }
  }

  if (tail === 'Csa.Netting:NettedBatch') {
    const p = e.payload as
      | { partyA?: string; partyB?: string; netByCcy?: [string, string][] }
      | undefined
    if (!p?.partyA || !p?.partyB) return null
    return {
      kind: 'NettedSettlement',
      partyA: p.partyA,
      partyB: p.partyB,
      netByCcy: (p.netByCcy ?? []).map(([ccy, amt]) => [ccy, Number.parseFloat(amt)]),
      cid: e.contractId,
      ts: e.ts,
    }
  }

  if (tail === 'Csa.Shortfall:MarginShortfall') {
    // Daml record fields are `debtor` (under-funded short side) and
    // `creditor` (in-the-money side); historical `partyA/partyB`
    // payload shape never existed on-ledger.
    const p = e.payload as { debtor?: string; creditor?: string } | undefined
    if (!p?.debtor || !p?.creditor) return null
    return {
      kind: 'ShortfallRecorded',
      partyA: p.debtor,
      partyB: p.creditor,
      cid: e.contractId,
      ts: e.ts,
    }
  }

  if (e.templateId.includes('Daml.Finance.Data.V4.Numeric.Observation:Observation')) {
    return { kind: 'OracleRatePublished', templateName: 'Observation', cid: e.contractId, ts: e.ts }
  }

  if (tail === 'Oracle.CurveSnapshot:CurveSnapshot') {
    return { kind: 'CurveSnapshotted', templateName: 'CurveSnapshot', cid: e.contractId, ts: e.ts }
  }

  return null
}

// Reverse of PROPOSAL_TEMPLATES (template-tail → family). Sourced from the
// shared workspace builder so a new family added there shows up in the
// timeline narrative automatically. v1 had a hand-maintained map that
// silently dropped XCCY — exactly the drift this avoids.
const PROPOSAL_TAIL_TO_FAMILY: Record<string, SwapFamily> = Object.fromEntries(
  (Object.entries(PROPOSAL_TEMPLATES) as [SwapFamily, string][]).map(([family, templateId]) => [
    templateId,
    family,
  ]),
)

// SwapWorkflow.swapType is the Daml-side string. Most are uppercase IRS/OIS/
// BASIS/etc. and match SwapFamily directly; "FpML" is the camelCase TS form
// while Daml stores "FPML" — normalise here.
function normaliseFamily(s: string): SwapFamily {
  if (s === 'FPML') return 'FpML'
  return s as SwapFamily
}
