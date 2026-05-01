import { usePartyDirectory } from 'canton-party-directory/react'
import { PartyName } from 'canton-party-directory/ui'
import type { ReactNode } from 'react'
import { LedgerCidLink } from '@/features/ledger/components/ledger-cid-link'
import type { BusinessEvent } from '../timeline/business-events'

const Pair = ({ a, b }: { a: string; b: string }) => {
  const { displayName } = usePartyDirectory()
  // Canonicalize pair orientation so ↔ reads the same direction across all
  // events on the same CSA pair (margin call vs shortfall used to flip).
  const [first, second] = displayName(a).localeCompare(displayName(b)) <= 0 ? [a, b] : [b, a]
  return (
    <>
      <PartyName identifier={first} /> ↔ <PartyName identifier={second} />
    </>
  )
}

const COLOR_BY_KIND: Record<BusinessEvent['kind'], string> = {
  TradeProposed: 'border-zinc-700 bg-zinc-900/50',
  TradeAccepted: 'border-green-700/50 bg-green-900/20',
  TradeMatured: 'border-blue-700/50 bg-blue-900/20',
  TradeTerminated: 'border-red-700/50 bg-red-900/20',
  CsaPublished: 'border-zinc-700 bg-zinc-900/50',
  MarginCalled: 'border-yellow-700/50 bg-yellow-900/20',
  DisputeOpened: 'border-amber-700/50 bg-amber-900/20',
  DisputeEscalated: 'border-rose-700/50 bg-rose-900/20',
  DisputeResolved: 'border-emerald-700/40 bg-emerald-900/15',
  MarkPosted: 'border-zinc-700 bg-zinc-900/50',
  NettedSettlement: 'border-green-700/50 bg-green-900/20',
  SettlementAudited: 'border-green-700/40 bg-green-900/15',
  ShortfallRecorded: 'border-red-700/50 bg-red-900/20',
  OracleRatePublished: 'border-blue-700/30 bg-blue-900/10',
  CurveSnapshotted: 'border-blue-700/30 bg-blue-900/10',
}

const SETTLEMENT_LABEL: Record<'swap-settle' | 'swap-mature' | 'csa-net', string> = {
  'swap-settle': 'Coupon settled',
  'swap-mature': 'Maturity settled',
  'csa-net': 'CSA netted',
}

function summarise(e: BusinessEvent): ReactNode {
  switch (e.kind) {
    case 'TradeProposed':
      return (
        <>
          {e.family} proposed — <PartyName identifier={e.proposer} /> →{' '}
          <PartyName identifier={e.counterparty} />
        </>
      )
    case 'TradeAccepted':
      return (
        <>
          {e.family} accepted — <Pair a={e.partyA} b={e.partyB} />, notional{' '}
          {(e.notional / 1_000_000).toFixed(1)}M
        </>
      )
    case 'TradeMatured':
      return (
        <>
          {e.family} matured — <Pair a={e.partyA} b={e.partyB} />
        </>
      )
    case 'TradeTerminated':
      return (
        <>
          {e.family} terminated — <Pair a={e.partyA} b={e.partyB} />
        </>
      )
    case 'CsaPublished':
      return (
        <>
          CSA updated — <Pair a={e.partyA} b={e.partyB} /> ({e.ccy})
        </>
      )
    case 'MarginCalled':
      return (
        <>
          Margin call — <Pair a={e.partyA} b={e.partyB} /> ({e.ccy})
        </>
      )
    case 'DisputeOpened':
      return (
        <>
          Dispute opened ({e.reason}) — <Pair a={e.partyA} b={e.partyB} />, counter-mark{' '}
          {e.counterMark.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
          {e.notes && <span className="text-zinc-500"> · {e.notes}</span>}
        </>
      )
    case 'DisputeEscalated':
      return (
        <>
          Dispute escalated — <Pair a={e.partyA} b={e.partyB} />
        </>
      )
    case 'DisputeResolved':
      return (
        <>
          Dispute resolved ({e.resolution}) — <Pair a={e.partyA} b={e.partyB} />
        </>
      )
    case 'MarkPosted':
      return (
        <>
          Mark posted — <Pair a={e.partyA} b={e.partyB} />, exposure{' '}
          {e.exposure.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
            signDisplay: 'always',
          })}
        </>
      )
    case 'NettedSettlement': {
      const fmt = (n: number) =>
        n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      const sum = e.netByCcy.map(([ccy, amt]) => `${fmt(amt)} ${ccy}`).join(', ')
      return (
        <>
          Netted settlement — <Pair a={e.partyA} b={e.partyB} />: {sum || '0'}
        </>
      )
    }
    case 'SettlementAudited':
      return (
        <>
          {SETTLEMENT_LABEL[e.source]} — <PartyName identifier={e.payer} /> →{' '}
          <PartyName identifier={e.payee} />{' '}
          {e.amount.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}{' '}
          {e.ccy}
        </>
      )
    case 'ShortfallRecorded':
      return (
        <>
          Margin shortfall — <Pair a={e.partyA} b={e.partyB} />
        </>
      )
    case 'OracleRatePublished':
      return `Oracle rate published`
    case 'CurveSnapshotted':
      return `Curve snapshot recorded`
  }
}

function relativeTime(ts: number): string {
  const ageMs = Date.now() - ts
  if (ageMs < 60_000) return `${Math.floor(ageMs / 1000)}s ago`
  if (ageMs < 3_600_000) return `${Math.floor(ageMs / 60_000)}m ago`
  if (ageMs < 86_400_000) return `${Math.floor(ageMs / 3_600_000)}h ago`
  return `${Math.floor(ageMs / 86_400_000)}d ago`
}

export function TimelineEventCard({ event }: { event: BusinessEvent }) {
  return (
    <div
      data-slot="timeline-card"
      data-kind={event.kind}
      className={`rounded border ${COLOR_BY_KIND[event.kind]} px-3 py-2 text-sm`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-zinc-200">{summarise(event)}</span>
        <span className="shrink-0 text-xs text-zinc-500">{relativeTime(event.ts)}</span>
      </div>
      <div className="mt-1">
        <LedgerCidLink cid={event.cid} truncate={24} />
      </div>
    </div>
  )
}
