import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { classify, parseFpml } from '../classify'

const loadFixture = (name: string): string =>
  fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf-8')

describe('parseFpml', () => {
  it('extracts effective + termination dates from swapStream', () => {
    const parsed = parseFpml(loadFixture('irs.xml'))
    expect(parsed.effectiveDate.toISOString().slice(0, 10)).toBe('2026-04-16')
    expect(parsed.terminationDate.toISOString().slice(0, 10)).toBe('2031-04-16')
  })

  it('extracts per-leg currency + notional + rate type', () => {
    const parsed = parseFpml(loadFixture('irs.xml'))
    expect(parsed.legs).toHaveLength(2)
    expect(parsed.legs[0].currency).toBe('USD')
    expect(parsed.legs[0].notional).toBe(10_000_000)
    expect(parsed.legs[0].rateType).toBe('fixed')
    expect(parsed.legs[0].fixedRate).toBe(0.0425)
    expect(parsed.legs[1].rateType).toBe('float')
    expect(parsed.legs[1].indexId).toBe('USD-LIBOR-3M')
  })

  it('extracts float-leg spread + compoundingMethod', () => {
    const parsed = parseFpml(loadFixture('basis.xml'))
    const effr = parsed.legs.find((l) => l.indexId === 'USD-EFFR')!
    expect(effr.spread).toBe(0.0015)
    expect(effr.compounding).toBe('OvernightAverage')
  })
})

describe('classify', () => {
  it('IRS fixture → productType: IRS', () => {
    const cls = classify(parseFpml(loadFixture('irs.xml')))
    expect(cls.productType).toBe('IRS')
  })

  it('OIS fixture → productType: OIS (SOFR + CompoundedInArrears)', () => {
    const cls = classify(parseFpml(loadFixture('ois.xml')))
    expect(cls.productType).toBe('OIS')
  })

  it('BASIS fixture → productType: BASIS (two floats, same currency)', () => {
    const cls = classify(parseFpml(loadFixture('basis.xml')))
    expect(cls.productType).toBe('BASIS')
  })

  it('XCCY fixture → productType: XCCY (fixed+float, different currencies)', () => {
    const cls = classify(parseFpml(loadFixture('xccy.xml')))
    expect(cls.productType).toBe('XCCY')
  })

  it('3-stream fixture → productType null with stream-count reason', () => {
    const cls = classify(parseFpml(loadFixture('unsupported.xml')))
    expect(cls.productType).toBeNull()
    if (cls.productType === null) {
      expect(cls.reason).toMatch(/stream count/i)
    }
  })

  it('IRS classification carries fixed + float legs', () => {
    const cls = classify(parseFpml(loadFixture('irs.xml')))
    if (cls.productType !== 'IRS') throw new Error('expected IRS')
    expect(cls.fixedLeg.rateType).toBe('fixed')
    expect(cls.floatLeg.rateType).toBe('float')
  })
})
