/**
 * Tests for the pure helper functions in mappers.ts:
 * getInstrumentCurrency, getInstrumentDirection, getInstrumentMaturity.
 */
import { describe, expect, it } from 'vitest'
import { getInstrumentCurrency, getInstrumentDirection, getInstrumentMaturity } from '../mappers'
import {
  ASSET_INSTR,
  BASIS_INSTR,
  CCY_INSTR,
  CDS_INSTR,
  FPML_INSTR,
  FX_INSTR,
  IRS_INSTR,
  OIS_INSTR,
  XCCY_INSTR,
} from './mapper-fixtures'

describe('getInstrumentCurrency', () => {
  it('IRS: returns currency id', () => {
    expect(getInstrumentCurrency(IRS_INSTR)).toBe('USD')
  })

  it('CDS: returns currency id', () => {
    expect(getInstrumentCurrency(CDS_INSTR)).toBe('USD')
  })

  it('CCY: returns baseCurrency id', () => {
    expect(getInstrumentCurrency(CCY_INSTR)).toBe('EUR')
  })

  it('FX: returns baseCurrency id', () => {
    expect(getInstrumentCurrency(FX_INSTR)).toBe('USD')
  })

  it('ASSET: returns currency id', () => {
    expect(getInstrumentCurrency(ASSET_INSTR)).toBe('USD')
  })

  it('FpML: returns first currency id', () => {
    expect(getInstrumentCurrency(FPML_INSTR)).toBe('USD')
  })

  it('OIS: returns currency id (shares IRS payload)', () => {
    expect(getInstrumentCurrency(OIS_INSTR)).toBe('USD')
  })

  it('BASIS: returns first currency id (shares FpML payload)', () => {
    expect(getInstrumentCurrency(BASIS_INSTR)).toBe('USD')
  })

  it('XCCY: returns first currency id (shares FpML payload)', () => {
    expect(getInstrumentCurrency(XCCY_INSTR)).toBe('USD')
  })

  it('undefined instrument: returns USD loading placeholder', () => {
    expect(getInstrumentCurrency(undefined)).toBe('USD')
  })
})

describe('getInstrumentDirection', () => {
  it('IRS partyA: pay', () => {
    expect(getInstrumentDirection(IRS_INSTR, true)).toBe('pay')
  })

  it('IRS partyB: receive', () => {
    expect(getInstrumentDirection(IRS_INSTR, false)).toBe('receive')
  })

  it('CDS ownerReceivesFix=true + isPartyA=true → receive', () => {
    expect(getInstrumentDirection(CDS_INSTR, true)).toBe('receive')
  })

  it('CDS ownerReceivesFix=true + isPartyA=false → pay', () => {
    expect(getInstrumentDirection(CDS_INSTR, false)).toBe('pay')
  })

  it('CCY ownerReceivesBase=true + isPartyA=true → receive', () => {
    expect(getInstrumentDirection(CCY_INSTR, true)).toBe('receive')
  })

  it('ASSET ownerReceivesRate=true + isPartyA=true → receive', () => {
    expect(getInstrumentDirection(ASSET_INSTR, true)).toBe('receive')
  })

  it('FX partyA: pay', () => {
    expect(getInstrumentDirection(FX_INSTR, true)).toBe('pay')
  })

  it('FpML partyA: pay', () => {
    expect(getInstrumentDirection(FPML_INSTR, true)).toBe('pay')
  })

  it('OIS partyA: pay (matches IRS)', () => {
    expect(getInstrumentDirection(OIS_INSTR, true)).toBe('pay')
  })

  it('BASIS partyA: pay (matches FpML)', () => {
    expect(getInstrumentDirection(BASIS_INSTR, true)).toBe('pay')
  })

  it('XCCY partyA: pay (matches FpML)', () => {
    expect(getInstrumentDirection(XCCY_INSTR, true)).toBe('pay')
  })

  it('undefined instrument: returns pay loading placeholder', () => {
    expect(getInstrumentDirection(undefined, true)).toBe('pay')
  })
})

describe('getInstrumentMaturity', () => {
  it('IRS: returns periodicSchedule.terminationDate', () => {
    expect(getInstrumentMaturity(IRS_INSTR)).toBe('2026-04-01')
  })

  it('CDS: returns periodicSchedule.terminationDate', () => {
    expect(getInstrumentMaturity(CDS_INSTR)).toBe('2027-01-01')
  })

  it('CCY: returns periodicSchedule.terminationDate', () => {
    expect(getInstrumentMaturity(CCY_INSTR)).toBe('2027-01-01')
  })

  it('ASSET: returns periodicSchedule.terminationDate', () => {
    expect(getInstrumentMaturity(ASSET_INSTR)).toBe('2027-01-01')
  })

  it('FX: returns maturityDate', () => {
    expect(getInstrumentMaturity(FX_INSTR)).toBe('2027-01-01')
  })

  it('FpML: returns swapStreams[0].calculationPeriodDates.terminationDate.unadjustedDate', () => {
    expect(getInstrumentMaturity(FPML_INSTR)).toBe('2028-01-01')
  })

  it('OIS: returns periodicSchedule.terminationDate (shares IRS payload)', () => {
    expect(getInstrumentMaturity(OIS_INSTR)).toBe('2026-04-01')
  })

  it('BASIS: returns FpML termination date', () => {
    expect(getInstrumentMaturity(BASIS_INSTR)).toBe('2028-01-01')
  })

  it('XCCY: returns FpML termination date', () => {
    expect(getInstrumentMaturity(XCCY_INSTR)).toBe('2028-01-01')
  })

  it('undefined instrument: returns — loading placeholder', () => {
    expect(getInstrumentMaturity(undefined)).toBe('—')
  })
})
