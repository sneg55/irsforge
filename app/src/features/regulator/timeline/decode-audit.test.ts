// SettlementAudit decode tests, split from decode.test.ts to keep both files
// under the 300-line cap. The audit row is the regulator-visible projection
// of cash settlements; see Audit/SettlementAudit.daml for the producer.
import { describe, expect, it } from 'vitest'
import type { LedgerActivityEvent } from '@/features/ledger/types'
import { decode } from './decode'

function ev(partial: Partial<LedgerActivityEvent>): LedgerActivityEvent {
  return {
    kind: 'create',
    templateId: 'unknown:Module:Type',
    contractId: 'cid',
    party: null,
    ts: 1700000000,
    ...partial,
  }
}

describe('decode — SettlementAudit', () => {
  it('decodes swap-settle source → SettlementAudited', () => {
    const out = decode(
      ev({
        templateId: 'pkg:Audit.SettlementAudit:SettlementAudit',
        contractId: 'sa1',
        payload: {
          source: 'swap-settle',
          payer: 'PartyB',
          payee: 'PartyA',
          ccy: 'USD',
          amount: '12345.67',
          sourceCid: 'wf1',
        },
      }),
    )
    expect(out).toEqual({
      kind: 'SettlementAudited',
      source: 'swap-settle',
      payer: 'PartyB',
      payee: 'PartyA',
      ccy: 'USD',
      amount: 12345.67,
      sourceCid: 'wf1',
      cid: 'sa1',
      ts: 1700000000,
    })
  })

  it('decodes csa-net source → SettlementAudited', () => {
    const out = decode(
      ev({
        templateId: 'pkg:Audit.SettlementAudit:SettlementAudit',
        contractId: 'sa2',
        payload: {
          source: 'csa-net',
          payer: 'PartyA',
          payee: 'PartyB',
          ccy: 'EUR',
          amount: '500.00',
          sourceCid: 'csa1',
        },
      }),
    )
    expect(out?.kind).toBe('SettlementAudited')
    if (out?.kind === 'SettlementAudited') expect(out.source).toBe('csa-net')
  })

  it('decodes swap-mature source → SettlementAudited', () => {
    const out = decode(
      ev({
        templateId: 'pkg:Audit.SettlementAudit:SettlementAudit',
        contractId: 'sa-mat',
        payload: {
          source: 'swap-mature',
          payer: 'PartyA',
          payee: 'PartyB',
          ccy: 'USD',
          amount: '999.99',
        },
      }),
    )
    expect(out?.kind).toBe('SettlementAudited')
    if (out?.kind === 'SettlementAudited') expect(out.source).toBe('swap-mature')
  })

  it('returns null for SettlementAudit with unknown source tag', () => {
    const out = decode(
      ev({
        templateId: 'pkg:Audit.SettlementAudit:SettlementAudit',
        contractId: 'sa3',
        payload: {
          source: 'reorg-undo',
          payer: 'PartyA',
          payee: 'PartyB',
          ccy: 'USD',
          amount: '100.00',
        },
      }),
    )
    expect(out).toBeNull()
  })

  it('returns null for malformed payload (missing payer)', () => {
    const out = decode(
      ev({
        templateId: 'pkg:Audit.SettlementAudit:SettlementAudit',
        contractId: 'sa4',
        payload: { source: 'swap-settle', payee: 'PartyA', ccy: 'USD', amount: '1.00' },
      }),
    )
    expect(out).toBeNull()
  })
})
