'use client'

import {
  arr,
  ContractRef,
  DateValue,
  EnumPill,
  FallbackSummary,
  InstrumentKeyLine,
  MaybeParty,
  Money,
  PartyList,
  Pct,
  Row,
  Section,
  str,
} from './payload-formatters'

export function SwapWorkflowSummary({ p }: { p: Record<string, unknown> }) {
  return (
    <Section title="Swap workflow">
      <Row label="Swap type">
        <EnumPill value={str(p.swapType)} tone="info" />
      </Row>
      <Row label="Party A">
        <MaybeParty value={str(p.partyA)} />
      </Row>
      <Row label="Party B">
        <MaybeParty value={str(p.partyB)} />
      </Row>
      <Row label="Notional">
        <Money amount={str(p.notional)} />
      </Row>
      <Row label="Operator">
        <MaybeParty value={str(p.operator)} />
      </Row>
      <Row label="Scheduler">
        <MaybeParty value={str(p.scheduler)} />
      </Row>
      <Row label="Regulators">
        <PartyList parties={arr(p.regulators)} />
      </Row>
      {p.instrumentKey ? (
        <Row label="Instrument">
          <InstrumentKeyLine k={p.instrumentKey as Record<string, unknown>} />
        </Row>
      ) : null}
    </Section>
  )
}

export function MaturedSwapSummary({ p }: { p: Record<string, unknown> }) {
  return (
    <Section title="Matured swap">
      <Row label="Swap type">
        <EnumPill value={str(p.swapType)} tone="info" />
      </Row>
      <Row label="Party A">
        <MaybeParty value={str(p.partyA)} />
      </Row>
      <Row label="Party B">
        <MaybeParty value={str(p.partyB)} />
      </Row>
      <Row label="Notional">
        <Money amount={str(p.notional)} />
      </Row>
      <Row label="Matured at">
        <DateValue iso={str(p.actualMaturityDate)} />
      </Row>
      <Row label="Final net">
        <Money amount={str(p.finalNetAmount)} signed />
      </Row>
      {p.finalSettleBatchCid ? (
        <Row label="Settle batch">
          <ContractRef cid={str(p.finalSettleBatchCid)} />
        </Row>
      ) : null}
    </Section>
  )
}

export function TerminatedSwapSummary({ p }: { p: Record<string, unknown> }) {
  return (
    <Section title="Terminated swap">
      <Row label="Swap type">
        <EnumPill value={str(p.swapType)} tone="danger" />
      </Row>
      <Row label="Party A">
        <MaybeParty value={str(p.partyA)} />
      </Row>
      <Row label="Party B">
        <MaybeParty value={str(p.partyB)} />
      </Row>
      <Row label="Notional">
        <Money amount={str(p.notional)} />
      </Row>
      <Row label="Terminated on">
        <DateValue iso={str(p.terminationDate)} />
      </Row>
      <Row label="Agreed PV">
        <Money amount={str(p.agreedPvAmount)} signed />
      </Row>
      <Row label="Reason">{str(p.reason) || '—'}</Row>
      <Row label="Initiator">
        <MaybeParty value={str(p.terminatedByParty)} />
      </Row>
    </Section>
  )
}

export function SwapProposalSummary({ p }: { p: Record<string, unknown> }) {
  return (
    <Section title="Swap proposal">
      <Row label="Proposer">
        <MaybeParty value={str(p.proposer)} />
      </Row>
      <Row label="Counterparty">
        <MaybeParty value={str(p.counterparty)} />
      </Row>
      <Row label="Notional">
        <Money amount={str(p.notional)} />
      </Row>
      {p.fixRate ? (
        <Row label="Fix rate">
          <Pct value={str(p.fixRate)} />
        </Row>
      ) : null}
      {p.tenor ? <Row label="Tenor">{str(p.tenor)}</Row> : null}
      {p.startDate ? (
        <Row label="Start">
          <DateValue iso={str(p.startDate)} />
        </Row>
      ) : null}
      {p.maturityDate ? (
        <Row label="Maturity">
          <DateValue iso={str(p.maturityDate)} />
        </Row>
      ) : null}
      {p.baseCurrency || p.foreignCurrency ? (
        <Row label="Currencies">
          {str(p.baseCurrency) || '?'} ↔ {str(p.foreignCurrency) || '?'}
        </Row>
      ) : null}
      {p.referenceName ? <Row label="Reference">{str(p.referenceName)}</Row> : null}
      {p.dayCountConvention ? <Row label="Day count">{str(p.dayCountConvention)}</Row> : null}
    </Section>
  )
}

export function AcceptAckSummary({ p }: { p: Record<string, unknown> }) {
  // Accept-ack payloads vary per family; the fallback grid already labels
  // and types every field correctly, so reuse it under a clearer header.
  return <FallbackSummary payload={p} />
}
