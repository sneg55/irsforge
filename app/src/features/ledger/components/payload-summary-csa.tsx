'use client'

import {
  CcyMap,
  ContractRef,
  DateValue,
  EnumPill,
  isCcyMap,
  MaybeParty,
  Money,
  type PillTone,
  Row,
  Section,
  str,
} from './payload-formatters'

export function CsaSummary({ p }: { p: Record<string, unknown> }) {
  const state = str(p.state)
  const stateTone = csaStateTone(state)
  return (
    <Section title="Credit support annex">
      <Row label="State">
        <EnumPill value={state} tone={stateTone} />
      </Row>
      <Row label="Party A">
        <MaybeParty value={str(p.partyA)} />
      </Row>
      <Row label="Party B">
        <MaybeParty value={str(p.partyB)} />
      </Row>
      <Row label="Valuation ccy">{str(p.valuationCcy)}</Row>
      <Row label="MTA">
        <Money amount={str(p.mta)} ccy={str(p.valuationCcy)} />
      </Row>
      <Row label="Rounding">
        <Money amount={str(p.rounding)} ccy={str(p.valuationCcy)} />
      </Row>
      <Row label="IM">
        <Money amount={str(p.imAmount)} ccy={str(p.valuationCcy)} />
      </Row>
      <Row label="Thresholds">
        {isCcyMap(p.threshold) ? <CcyMap entries={p.threshold} /> : <em>n/a</em>}
      </Row>
      <Row label="CSB (signed)">{isCcyMap(p.csb) ? <CcyMap entries={p.csb} /> : <em>n/a</em>}</Row>
      <Row label="Governing law">{str(p.governingLaw)}</Row>
      <Row label="ISDA ref">{str(p.isdaMasterAgreementRef) || '—'}</Row>
      {p.lastMarkCid ? (
        <Row label="Last mark">
          <ContractRef cid={str(p.lastMarkCid)} />
        </Row>
      ) : null}
      {p.activeDispute ? (
        <Row label="Active dispute">
          <ContractRef cid={str(p.activeDispute)} />
        </Row>
      ) : null}
    </Section>
  )
}

function csaStateTone(state: string): PillTone {
  if (state === 'Active') return 'good'
  if (state === 'MarginCallOutstanding') return 'warn'
  if (state === 'MarkDisputed' || state === 'Escalated') return 'danger'
  return 'neutral'
}

export function MarkSummary({ p }: { p: Record<string, unknown> }) {
  return (
    <Section title="Mark-to-market">
      <Row label="Party A">
        <MaybeParty value={str(p.partyA)} />
      </Row>
      <Row label="Party B">
        <MaybeParty value={str(p.partyB)} />
      </Row>
      <Row label="As of">
        <DateValue iso={str(p.asOf)} />
      </Row>
      <Row label="Exposure">
        <Money amount={str(p.exposure)} signed />
      </Row>
      {p.csaCid ? (
        <Row label="CSA">
          <ContractRef cid={str(p.csaCid)} />
        </Row>
      ) : null}
    </Section>
  )
}

export function ShortfallSummary({ p }: { p: Record<string, unknown> }) {
  return (
    <Section title="Margin shortfall">
      <Row label="Debtor">
        <MaybeParty value={str(p.debtor)} />
      </Row>
      <Row label="Creditor">
        <MaybeParty value={str(p.creditor)} />
      </Row>
      <Row label="Deficit">
        <Money amount={str(p.deficit)} ccy={str(p.currency)} />
      </Row>
      <Row label="As of">
        <DateValue iso={str(p.asOf)} />
      </Row>
      {p.relatedMark ? (
        <Row label="Mark">
          <ContractRef cid={str(p.relatedMark)} />
        </Row>
      ) : null}
      {p.csaCid ? (
        <Row label="CSA">
          <ContractRef cid={str(p.csaCid)} />
        </Row>
      ) : null}
    </Section>
  )
}

export function NettedBatchSummary({ p }: { p: Record<string, unknown> }) {
  return (
    <Section title="Netted batch">
      <Row label="Party A">
        <MaybeParty value={str(p.partyA)} />
      </Row>
      <Row label="Party B">
        <MaybeParty value={str(p.partyB)} />
      </Row>
      <Row label="Paid at">
        <DateValue iso={str(p.paymentTimestamp)} />
      </Row>
      <Row label="Net by ccy">
        {isCcyMap(p.netByCcy) ? (
          <CcyMap entries={p.netByCcy} />
        ) : (
          <span className="text-zinc-500">none</span>
        )}
      </Row>
      {p.csaCid ? (
        <Row label="CSA">
          <ContractRef cid={str(p.csaCid)} />
        </Row>
      ) : null}
      {p.batchCid ? (
        <Row label="Batch">
          <ContractRef cid={str(p.batchCid)} />
        </Row>
      ) : null}
    </Section>
  )
}

export function DisputeRecordSummary({ p }: { p: Record<string, unknown> }) {
  return (
    <Section title="CSA dispute">
      <Row label="Reason">
        <EnumPill value={str(p.reason)} tone="warn" />
      </Row>
      <Row label="Party A">
        <MaybeParty value={str(p.partyA)} />
      </Row>
      <Row label="Party B">
        <MaybeParty value={str(p.partyB)} />
      </Row>
      <Row label="Disputer">
        <MaybeParty value={str(p.disputer)} />
      </Row>
      <Row label="Counter-mark">
        <Money amount={str(p.counterMark)} signed />
      </Row>
      <Row label="Opened">
        <DateValue iso={str(p.openedAt)} />
      </Row>
      <Row label="Notes">{str(p.notes) || <span className="text-zinc-500">—</span>}</Row>
      {p.csaCid ? (
        <Row label="CSA">
          <ContractRef cid={str(p.csaCid)} />
        </Row>
      ) : null}
    </Section>
  )
}

export function CsaProposalSummary({ p }: { p: Record<string, unknown> }) {
  return (
    <Section title="CSA proposal">
      <Row label="Proposer">
        <MaybeParty value={str(p.proposer)} />
      </Row>
      <Row label="Counterparty">
        <MaybeParty value={str(p.counterparty)} />
      </Row>
      <Row label="Valuation ccy">{str(p.valuationCcy)}</Row>
      {p.mta ? (
        <Row label="MTA">
          <Money amount={str(p.mta)} ccy={str(p.valuationCcy)} />
        </Row>
      ) : null}
      {p.governingLaw ? <Row label="Governing law">{str(p.governingLaw)}</Row> : null}
      {p.isdaMasterAgreementRef ? (
        <Row label="ISDA ref">{str(p.isdaMasterAgreementRef)}</Row>
      ) : null}
    </Section>
  )
}

export function SettlementAuditSummary({ p }: { p: Record<string, unknown> }) {
  return (
    <Section title="Settlement audit">
      <Row label="Source">
        <EnumPill value={str(p.source)} tone="info" />
      </Row>
      <Row label="Payer">
        <MaybeParty value={str(p.payer)} />
      </Row>
      <Row label="Payee">
        <MaybeParty value={str(p.payee)} />
      </Row>
      <Row label="Amount">
        <Money amount={str(p.amount)} ccy={str(p.ccy)} />
      </Row>
      {p.sourceCid ? (
        <Row label="Source ref">
          <ContractRef cid={str(p.sourceCid)} />
        </Row>
      ) : null}
    </Section>
  )
}
