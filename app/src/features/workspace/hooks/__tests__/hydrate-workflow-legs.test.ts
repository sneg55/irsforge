import type {
  AssetLegConfig,
  FixedLegConfig,
  FloatLegConfig,
  FxLegConfig,
  ProtectionLegConfig,
} from '@irsforge/shared-pricing'
import { describe, expect, test } from 'vitest'
import { hydrateWorkflowPayload } from '../hydrate-workflow-legs'
import {
  assetInstr,
  basisInstr,
  ccyInstr,
  cdsInstr,
  fxInstr,
  irsInstr,
  workflow,
} from './hydrate-workflow-fixtures'

describe('hydrateWorkflowPayload — IRS / OIS', () => {
  test('reads notional from workflow, rate/dates/index from instrument', () => {
    const result = hydrateWorkflowPayload('IRS', workflow('IRS', '10000000.0'), {
      swapType: 'IRS',
      payload: irsInstr(),
    })
    expect(result.swapType).toBe('IRS')
    const fixed = result.legs[0] as FixedLegConfig
    const float = result.legs[1] as FloatLegConfig
    expect(fixed.notional).toBe(10_000_000)
    expect(fixed.rate).toBe(0.0425)
    expect(fixed.dayCount).toBe('ACT_360')
    expect(fixed.schedule.frequency).toBe('Quarterly')
    expect(float.indexId).toBe('USD-SOFR')
    expect(float.notional).toBe(10_000_000)
    expect(result.dates.effectiveDate.getFullYear()).toBe(2026)
    expect(result.dates.maturityDate.getFullYear()).toBe(2031)
  })

  test('OIS uses Annual schedule and respects Act365Fixed day-count', () => {
    const result = hydrateWorkflowPayload('OIS', workflow('OIS', '25000000.0'), {
      swapType: 'OIS',
      payload: irsInstr({ fixRate: '0.04', dayCount: 'Act365Fixed' }),
    })
    expect(result.swapType).toBe('OIS')
    const fixed = result.legs[0] as FixedLegConfig
    expect(fixed.schedule.frequency).toBe('Annual')
    expect(fixed.dayCount).toBe('ACT_365')
    expect(fixed.notional).toBe(25_000_000)
  })
})

describe('hydrateWorkflowPayload — BASIS / CCY', () => {
  test('BASIS reads two float legs with correct indexIds and spreads', () => {
    const result = hydrateWorkflowPayload('BASIS', workflow('BASIS', '25000000.0'), {
      swapType: 'BASIS',
      payload: basisInstr(),
    })
    expect(result.swapType).toBe('BASIS')
    expect(result.legs).toHaveLength(2)
    const leg0 = result.legs[0] as FloatLegConfig
    const leg1 = result.legs[1] as FloatLegConfig
    expect(leg0.indexId).toBe('USD-SOFR')
    expect(leg0.spread).toBe(0)
    expect(leg0.direction).toBe('pay')
    expect(leg1.indexId).toBe('USD-EFFR')
    expect(leg1.spread).toBeCloseTo(0.0025, 6)
    expect(leg1.direction).toBe('receive')
  })

  test('CCY hydrator yields fixed/fixed legs in two currencies, scaled by fxRate', () => {
    const result = hydrateWorkflowPayload('CCY', workflow('CCY', '10000000.0'), {
      swapType: 'CCY',
      payload: ccyInstr(),
    })
    expect(result.swapType).toBe('CCY')
    const usd = result.legs[0] as FixedLegConfig
    const eur = result.legs[1] as FixedLegConfig
    expect(usd.currency).toBe('USD')
    expect(usd.notional).toBe(10_000_000)
    expect(eur.currency).toBe('EUR')
    expect(eur.notional).toBe(9_000_000)
  })
})

describe('hydrateWorkflowPayload — FX / CDS / ASSET', () => {
  test('FX hydrator produces two fx legs at first/final dates', () => {
    const result = hydrateWorkflowPayload('FX', workflow('FX', '10000000.0'), {
      swapType: 'FX',
      payload: fxInstr(),
    })
    const a = result.legs[0] as FxLegConfig
    const b = result.legs[1] as FxLegConfig
    expect(a.fxRate).toBeCloseTo(1.08, 4)
    expect(b.fxRate).toBeCloseTo(1.085, 4)
    expect(a.paymentDate.getMonth()).toBe(6) // July (zero-indexed)
  })

  test('CDS hydrator yields fixed + protection', () => {
    const result = hydrateWorkflowPayload('CDS', workflow('CDS', '10000000.0'), {
      swapType: 'CDS',
      payload: cdsInstr(),
    })
    expect(result.legs).toHaveLength(2)
    const fixed = result.legs[0] as FixedLegConfig
    const protection = result.legs[1] as ProtectionLegConfig
    expect(fixed.rate).toBeCloseTo(0.01, 6)
    expect(protection.legType).toBe('protection')
    expect(protection.notional).toBe(10_000_000)
  })

  test('ASSET hydrator with floating rate leg', () => {
    const result = hydrateWorkflowPayload('ASSET', workflow('ASSET', '5000000.0'), {
      swapType: 'ASSET',
      payload: assetInstr(),
    })
    const asset = result.legs[0] as AssetLegConfig
    const rate = result.legs[1] as FloatLegConfig
    expect(asset.legType).toBe('asset')
    expect(asset.underlyings[0].assetId).toBe('UST-10Y')
    expect(rate.legType).toBe('float')
    expect(rate.indexId).toBe('USD-SOFR')
  })
})
