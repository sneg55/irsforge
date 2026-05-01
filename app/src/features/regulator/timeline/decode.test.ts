import { describe, expect, it } from 'vitest'
import { ev } from './__test-fixtures__/decode-fixtures'
import { decode } from './decode'

// Dispute-lifecycle tests live in `decode-dispute.test.ts` (sibling file).
// Splitting keeps each test file under the 300-line cap.

describe('decode', () => {
  it('returns null for unknown templates', () => {
    expect(decode(ev({ templateId: 'pkg:Random.Module:Foo' }))).toBe(null)
  })

  it('returns null for archive of templates without a dispute-resolution branch', () => {
    expect(decode(ev({ kind: 'archive', templateId: 'pkg:Csa.Csa:Csa' }))).toBe(null)
  })

  it('returns null for malformed payload (missing required fields)', () => {
    const e = ev({
      kind: 'create',
      templateId: 'pkg:Csa.Csa:Csa',
      payload: { state: 'Active' },
    })
    expect(decode(e)).toBe(null)
  })

  it('decodes Swap.Proposal:SwapProposal → TradeProposed[IRS]', () => {
    const out = decode(
      ev({
        templateId: 'pkg:Swap.Proposal:SwapProposal',
        contractId: 'p1',
        ts: 1700000000,
        payload: { proposer: 'PartyA', counterparty: 'PartyB' },
      }),
    )
    expect(out).toEqual({
      kind: 'TradeProposed',
      family: 'IRS',
      proposer: 'PartyA',
      counterparty: 'PartyB',
      cid: 'p1',
      ts: 1700000000,
    })
  })

  it.each([
    ['pkg:Swap.OisProposal:OisProposal', 'OIS'],
    ['pkg:Swap.BasisSwapProposal:BasisSwapProposal', 'BASIS'],
    ['pkg:Swap.CdsProposal:CdsProposal', 'CDS'],
    ['pkg:Swap.CcySwapProposal:CcySwapProposal', 'CCY'],
    ['pkg:Swap.FxSwapProposal:FxSwapProposal', 'FX'],
    ['pkg:Swap.AssetSwapProposal:AssetSwapProposal', 'ASSET'],
    ['pkg:Swap.FpmlProposal:FpmlProposal', 'FpML'],
  ])('decodes %s as TradeProposed family=%s', (templateId, family) => {
    const out = decode(
      ev({
        templateId,
        payload: { proposer: 'PartyA', counterparty: 'PartyB' },
      }),
    )
    expect(out?.kind).toBe('TradeProposed')
    if (out?.kind === 'TradeProposed') expect(out.family).toBe(family)
  })

  it('decodes Swap.Workflow:SwapWorkflow create → TradeAccepted', () => {
    const out = decode(
      ev({
        templateId: 'pkg:Swap.Workflow:SwapWorkflow',
        contractId: 'wf1',
        payload: {
          swapType: 'IRS',
          partyA: 'PartyA',
          partyB: 'PartyB',
          notional: '100000000.0',
        },
      }),
    )
    expect(out).toEqual({
      kind: 'TradeAccepted',
      family: 'IRS',
      partyA: 'PartyA',
      partyB: 'PartyB',
      notional: 100_000_000,
      cid: 'wf1',
      ts: 1700000000,
    })
  })

  it('decodes Swap.Workflow:MaturedSwap create → TradeMatured', () => {
    const out = decode(
      ev({
        templateId: 'pkg:Swap.Workflow:MaturedSwap',
        contractId: 'm1',
        payload: { swapType: 'OIS', partyA: 'PartyA', partyB: 'PartyB' },
      }),
    )
    expect(out?.kind).toBe('TradeMatured')
    if (out?.kind === 'TradeMatured') expect(out.family).toBe('OIS')
  })

  it('decodes Swap.Terminate:TerminatedSwap create → TradeTerminated', () => {
    const out = decode(
      ev({
        templateId: 'pkg:Swap.Terminate:TerminatedSwap',
        contractId: 't1',
        payload: { swapType: 'IRS', partyA: 'PartyA', partyB: 'PartyB' },
      }),
    )
    expect(out?.kind).toBe('TradeTerminated')
  })

  it('decodes Csa.Csa:Csa create state=Active → CsaPublished', () => {
    const out = decode(
      ev({
        templateId: 'pkg:Csa.Csa:Csa',
        contractId: 'csa1',
        payload: {
          partyA: 'PartyA',
          partyB: 'PartyB',
          valuationCcy: 'USD',
          state: 'Active',
          csb: [['USD', '0.0']],
        },
      }),
    )
    expect(out?.kind).toBe('CsaPublished')
    if (out?.kind === 'CsaPublished') {
      expect(out.state).toBe('Active')
      expect(out.ccy).toBe('USD')
    }
  })

  it('decodes Csa.Csa:Csa create state=MarginCallOutstanding → MarginCalled', () => {
    const out = decode(
      ev({
        templateId: 'pkg:Csa.Csa:Csa',
        contractId: 'csa2',
        payload: {
          partyA: 'PartyA',
          partyB: 'PartyB',
          valuationCcy: 'USD',
          state: 'MarginCallOutstanding',
          csb: [['USD', '5000000.0']],
        },
      }),
    )
    expect(out?.kind).toBe('MarginCalled')
  })

  it('decodes Csa.Mark:MarkToMarket → MarkPosted', () => {
    const out = decode(
      ev({
        templateId: 'pkg:Csa.Mark:MarkToMarket',
        contractId: 'mk1',
        payload: {
          partyA: 'PartyA',
          partyB: 'PartyB',
          asOf: '2026-04-25T00:00:00Z',
          exposure: '1234567.89',
        },
      }),
    )
    expect(out).toEqual({
      kind: 'MarkPosted',
      partyA: 'PartyA',
      partyB: 'PartyB',
      exposure: 1234567.89,
      asOf: '2026-04-25T00:00:00Z',
      cid: 'mk1',
      ts: 1700000000,
    })
  })

  it('decodes Csa.Netting:NettedBatch → NettedSettlement', () => {
    const out = decode(
      ev({
        templateId: 'pkg:Csa.Netting:NettedBatch',
        contractId: 'nb1',
        payload: {
          partyA: 'PartyA',
          partyB: 'PartyB',
          netByCcy: [['USD', '500000.0']],
        },
      }),
    )
    expect(out?.kind).toBe('NettedSettlement')
    if (out?.kind === 'NettedSettlement') {
      expect(out.netByCcy).toEqual([['USD', 500000]])
    }
  })

  it('decodes Csa.Shortfall:MarginShortfall → ShortfallRecorded', () => {
    const out = decode(
      ev({
        templateId: 'pkg:Csa.Shortfall:MarginShortfall',
        contractId: 's1',
        payload: {
          operator: 'Op',
          csaCid: 'cid',
          debtor: 'PartyA',
          creditor: 'PartyB',
          regulators: ['Reg'],
          currency: 'USD',
          deficit: '1000.0',
          asOf: '2026-04-28T00:00:00Z',
          relatedMark: 'mk',
        },
      }),
    )
    expect(out?.kind).toBe('ShortfallRecorded')
    if (out?.kind === 'ShortfallRecorded') {
      expect(out.partyA).toBe('PartyA')
      expect(out.partyB).toBe('PartyB')
    }
  })

  it('decodes Daml.Finance.Data.V4.Numeric.Observation → OracleRatePublished', () => {
    const out = decode(
      ev({
        templateId: 'pkg:Daml.Finance.Data.V4.Numeric.Observation:Observation',
        contractId: 'obs1',
        payload: {},
      }),
    )
    expect(out?.kind).toBe('OracleRatePublished')
  })

  it('decodes Oracle.CurveSnapshot → CurveSnapshotted', () => {
    const out = decode(
      ev({
        templateId: 'pkg:Oracle.CurveSnapshot:CurveSnapshot',
        contractId: 'cs1',
        payload: {},
      }),
    )
    expect(out?.kind).toBe('CurveSnapshotted')
  })
})
