'use client'

import { DateValue, MaybeParty, Row, Section, str } from './payload-formatters'

export function CurveSummary({ p }: { p: Record<string, unknown> }) {
  return (
    <Section title="Yield curve">
      <Row label="Currency">{str(p.currency)}</Row>
      <Row label="Curve id">{str(p.curveId)}</Row>
      {p.asOf ? (
        <Row label="As of">
          <DateValue iso={str(p.asOf)} />
        </Row>
      ) : null}
      <Row label="Provider">
        <MaybeParty value={str(p.provider)} />
      </Row>
    </Section>
  )
}

export function CurveSnapshotSummary({ p }: { p: Record<string, unknown> }) {
  return (
    <Section title="Curve snapshot">
      <Row label="Currency">{str(p.currency)}</Row>
      <Row label="Curve id">{str(p.curveId)}</Row>
      {p.asOf ? (
        <Row label="As of">
          <DateValue iso={str(p.asOf)} />
        </Row>
      ) : null}
    </Section>
  )
}

export function ObservationSummary({ p }: { p: Record<string, unknown> }) {
  return (
    <Section title="Oracle observation">
      <Row label="Provider">
        <MaybeParty value={str(p.provider)} />
      </Row>
      <Row label="Id">{str(p.id)}</Row>
      {p.observations ? (
        <Row label="Observations">
          {Array.isArray(p.observations) ? `${p.observations.length} point(s)` : '—'}
        </Row>
      ) : null}
    </Section>
  )
}
