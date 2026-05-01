import type { CsaState, DisputeReason } from '@/shared/ledger/types'
import type { SwapFamily } from '../hooks/use-all-proposals-cross-org'

export type BusinessEventKind =
  | 'TradeProposed'
  | 'TradeAccepted'
  | 'TradeMatured'
  | 'TradeTerminated'
  | 'CsaPublished'
  | 'MarginCalled'
  | 'MarkPosted'
  | 'NettedSettlement'
  | 'SettlementAudited'
  | 'ShortfallRecorded'
  | 'OracleRatePublished'
  | 'CurveSnapshotted'
  // Dispute lifecycle event kinds. `DisputeOpened` fires on a
  // `Csa.Dispute:DisputeRecord` create; `DisputeEscalated` fires on a
  // `Csa.Csa:Csa` create whose `state` is `'Escalated'`; `DisputeResolved`
  // fires on a `Csa.Dispute:DisputeRecord` archive (resolution sourced from
  // the exercising-choice name when available, otherwise defaults to
  // `'operator-ack'`). The legacy `MarkDisputed` kind was dropped — the
  // disputed signal now flows from `DisputeRecord` events, not from a
  // `Csa.Csa` state read.
  | 'DisputeOpened'
  | 'DisputeEscalated'
  | 'DisputeResolved'

export type BusinessEvent =
  | {
      kind: 'TradeProposed'
      family: SwapFamily
      proposer: string
      counterparty: string
      cid: string
      ts: number
    }
  | {
      kind: 'TradeAccepted'
      family: SwapFamily
      partyA: string
      partyB: string
      notional: number
      cid: string
      ts: number
    }
  | {
      kind: 'TradeMatured'
      family: SwapFamily
      partyA: string
      partyB: string
      cid: string
      ts: number
    }
  | {
      kind: 'TradeTerminated'
      family: SwapFamily
      partyA: string
      partyB: string
      cid: string
      ts: number
    }
  | {
      kind: 'CsaPublished'
      partyA: string
      partyB: string
      ccy: string
      state: CsaState
      cid: string
      ts: number
    }
  | { kind: 'MarginCalled'; partyA: string; partyB: string; ccy: string; cid: string; ts: number }
  | {
      kind: 'DisputeOpened'
      partyA: string
      partyB: string
      disputer: string
      reason: DisputeReason
      counterMark: number
      notes: string
      cid: string
      ts: number
    }
  | { kind: 'DisputeEscalated'; partyA: string; partyB: string; cid: string; ts: number }
  | {
      kind: 'DisputeResolved'
      partyA: string
      partyB: string
      resolution: 'agreed' | 'operator-ack'
      cid: string
      ts: number
    }
  | {
      kind: 'MarkPosted'
      partyA: string
      partyB: string
      exposure: number
      asOf: string
      cid: string
      ts: number
    }
  | {
      kind: 'NettedSettlement'
      partyA: string
      partyB: string
      netByCcy: [string, number][]
      cid: string
      ts: number
    }
  | {
      // Cash-leg audit trail. Source tag distinguishes per-trade settlement
      // (`swap-settle` / `swap-mature`) from per-CSA netting (`csa-net`).
      kind: 'SettlementAudited'
      source: 'swap-settle' | 'swap-mature' | 'csa-net'
      payer: string
      payee: string
      ccy: string
      amount: number
      sourceCid: string
      cid: string
      ts: number
    }
  | { kind: 'ShortfallRecorded'; partyA: string; partyB: string; cid: string; ts: number }
  | { kind: 'OracleRatePublished'; templateName: string; cid: string; ts: number }
  | { kind: 'CurveSnapshotted'; templateName: string; cid: string; ts: number }

/** Whether an event falls into the "system noise" bucket — hidden by default
 *  on the timeline page until the user toggles "Include system events". */
export const SYSTEM_KINDS: readonly BusinessEventKind[] = [
  'OracleRatePublished',
  'CurveSnapshotted',
] as const

export function isSystemKind(kind: BusinessEventKind): boolean {
  return (SYSTEM_KINDS as readonly string[]).includes(kind)
}
