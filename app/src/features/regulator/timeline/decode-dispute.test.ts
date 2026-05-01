import { describe, expect, it } from 'vitest'
import { ev } from './__test-fixtures__/decode-fixtures'
import { decode } from './decode'

// Dispute-lifecycle decode tests are split out of `decode.test.ts` to keep
// each file under the 300-line limit. Covers the four dispute-related
// branches added in Task 16: DisputeOpened (DisputeRecord create),
// DisputeEscalated (Csa state=Escalated), DisputeResolved/agreed (archive
// with choice=AgreeToCounterMark), DisputeResolved/operator-ack (archive
// with choice=AcknowledgeDispute or default).

describe('decode — dispute lifecycle', () => {
  it('returns null for Csa.Csa:Csa create state=MarkDisputed (signal moved to DisputeRecord)', () => {
    const out = decode(
      ev({
        templateId: 'pkg:Csa.Csa:Csa',
        contractId: 'csa3',
        payload: {
          partyA: 'PartyA',
          partyB: 'PartyB',
          valuationCcy: 'USD',
          state: 'MarkDisputed',
          csb: [['USD', '0.0']],
        },
      }),
    )
    expect(out).toBe(null)
  })

  it('decodes Csa.Csa:Csa create state=Escalated → DisputeEscalated', () => {
    const out = decode(
      ev({
        templateId: 'pkg:Csa.Csa:Csa',
        contractId: 'csa4',
        payload: {
          partyA: 'pa',
          partyB: 'pb',
          valuationCcy: 'USD',
          state: 'Escalated',
          csb: [['USD', '0.0']],
        },
      }),
    )
    expect(out).toMatchObject({ kind: 'DisputeEscalated', partyA: 'pa', partyB: 'pb' })
  })

  it('decodes Csa.Dispute:DisputeRecord create → DisputeOpened', () => {
    const out = decode(
      ev({
        templateId: 'pkg:Csa.Dispute:DisputeRecord',
        contractId: 'dr1',
        payload: {
          partyA: 'pa',
          partyB: 'pb',
          disputer: 'pa',
          counterMark: '800000.0',
          reason: 'Valuation',
          notes: 'off by 200k',
          openedAt: '2026-04-17T12:00:00Z',
        },
      }),
    )
    expect(out).toEqual(
      expect.objectContaining({
        kind: 'DisputeOpened',
        partyA: 'pa',
        partyB: 'pb',
        disputer: 'pa',
        reason: 'Valuation',
        counterMark: 800000,
        notes: 'off by 200k',
        cid: 'dr1',
      }),
    )
  })

  it('decodes DisputeRecord archive with sibling AgreeToCounterMark as DisputeResolved/agreed', () => {
    const out = decode(
      ev({
        kind: 'archive',
        templateId: 'pkg:Csa.Dispute:DisputeRecord',
        contractId: 'dr2',
        choice: 'AgreeToCounterMark',
        payload: { partyA: 'pa', partyB: 'pb' },
      }),
    )
    expect(out).toMatchObject({
      kind: 'DisputeResolved',
      resolution: 'agreed',
      partyA: 'pa',
      partyB: 'pb',
    })
  })

  it('decodes DisputeRecord archive with sibling AcknowledgeDispute as DisputeResolved/operator-ack', () => {
    const out = decode(
      ev({
        kind: 'archive',
        templateId: 'pkg:Csa.Dispute:DisputeRecord',
        contractId: 'dr3',
        choice: 'AcknowledgeDispute',
        payload: { partyA: 'pa', partyB: 'pb' },
      }),
    )
    expect(out).toMatchObject({ kind: 'DisputeResolved', resolution: 'operator-ack' })
  })
})
