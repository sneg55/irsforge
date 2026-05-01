import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildProposalFromClassification } from '../build-proposal'
import { classify, parseFpml } from '../classify'

const loadFixture = (name: string): string =>
  fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf-8')

function buildFromFixture(name: string) {
  const parsed = parseFpml(loadFixture(name))
  const cls = classify(parsed)
  return buildProposalFromClassification(cls, parsed.effectiveDate, parsed.terminationDate)
}

describe('buildProposalFromClassification', () => {
  it('IRS fixture → IRS typed payload', () => {
    const out = buildFromFixture('irs.xml')
    expect(out.type).toBe('IRS')
    if (out.type !== 'IRS') throw new Error('expected IRS')
    expect(out.payload).toEqual({
      notional: 10_000_000,
      currency: 'USD',
      fixRate: 0.0425,
      floatingRateId: 'USD-LIBOR-3M',
      floatingSpread: 0,
      startDate: '2026-04-16',
      maturityDate: '2031-04-16',
      dayCount: 'Act360',
      // irs.xml has no payerPartyReference → defaults to 'receive' (owner receives fixed)
      fixedDirection: 'receive',
    })
  })

  it('OIS fixture → OIS typed payload (SOFR + CompoundedInArrears)', () => {
    const out = buildFromFixture('ois.xml')
    expect(out.type).toBe('OIS')
    if (out.type !== 'OIS') throw new Error('expected OIS')
    expect(out.payload.floatingRateId).toBe('USD-SOFR')
    expect(out.payload.fixRate).toBe(0.035)
    expect(out.payload.notional).toBe(25_000_000)
  })

  it('BASIS fixture → BASIS typed payload (two floats, per-leg spreads)', () => {
    const out = buildFromFixture('basis.xml')
    expect(out.type).toBe('BASIS')
    if (out.type !== 'BASIS') throw new Error('expected BASIS')
    expect(out.payload.leg0IndexId).toBe('USD-SOFR')
    expect(out.payload.leg1IndexId).toBe('USD-EFFR')
    expect(out.payload.leg0Spread).toBe(0)
    expect(out.payload.leg1Spread).toBe(0.0015)
    expect(out.payload.currency).toBe('USD')
  })

  it('XCCY fixture → XCCY typed payload (fixed USD + float EUR)', () => {
    const out = buildFromFixture('xccy.xml')
    expect(out.type).toBe('XCCY')
    if (out.type !== 'XCCY') throw new Error('expected XCCY')
    expect(out.payload.fixedCurrency).toBe('USD')
    expect(out.payload.floatCurrency).toBe('EUR')
    expect(out.payload.fixedRate).toBe(0.042)
    expect(out.payload.floatIndexId).toBe('EUR-ESTR')
  })

  it('unsupported classification throws with the classifier reason', () => {
    const parsed = parseFpml(loadFixture('unsupported.xml'))
    const cls = classify(parsed)
    expect(() =>
      buildProposalFromClassification(cls, parsed.effectiveDate, parsed.terminationDate),
    ).toThrow(/stream count/i)
  })
})
