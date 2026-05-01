import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type {
  DiscountCurve,
  FixedLegConfig,
  FloatingRateIndex,
  FloatLegConfig,
  PricingContext,
  SwapConfig,
} from '@irsforge/shared-pricing'
import { describe, expect, it } from 'vitest'
import type { SwapWorkflow } from '../../../shared/types.js'
import { computeMark } from '../compute.js'
import type { DecodedCsa } from '../decode.js'
import type { NettingSetEntry } from '../netting-set.js'

const here = dirname(fileURLToPath(import.meta.url))
const fix = JSON.parse(readFileSync(join(here, 'fixtures/two-irs-pa-pb.json'), 'utf8')) as {
  curve: DiscountCurve
  index: FloatingRateIndex
  swaps: Array<{
    contractId: string
    ownerReceivesFix: boolean
    tradeDate: string
    effectiveDate: string
    maturityDate: string
    fixedRate: number
    notional: number
  }>
}

function buildConfig(s: (typeof fix.swaps)[number]): SwapConfig {
  const effectiveDate = new Date(s.effectiveDate)
  const maturityDate = new Date(s.maturityDate)
  const schedule = {
    startDate: effectiveDate,
    endDate: maturityDate,
    frequency: 'Quarterly' as const,
  }
  // Positive fixed notional = owner receives fix. Sign flips the float
  // leg so cashflows are properly opposed, matching the standard IRS
  // convention shared-pricing uses elsewhere (see par-rate tests).
  const sign = s.ownerReceivesFix ? 1 : -1
  const fixed: FixedLegConfig = {
    legType: 'fixed',
    direction: 'receive',
    currency: 'USD',
    notional: sign * s.notional,
    rate: s.fixedRate,
    dayCount: 'ACT_360',
    schedule,
  }
  const float: FloatLegConfig = {
    legType: 'float',
    direction: 'receive',
    currency: 'USD',
    notional: -sign * s.notional,
    indexId: fix.index.indexId,
    spread: 0,
    dayCount: 'ACT_360',
    schedule,
  }
  return {
    type: 'IRS',
    legs: [fixed, float],
    tradeDate: new Date(s.tradeDate),
    effectiveDate,
    maturityDate,
  }
}

describe('computeMark', () => {
  it('nets to ≈ 0 for two opposite-direction IRS at par', async () => {
    const csa: DecodedCsa = {
      contractId: 'csa1',
      operator: 'Op',
      partyA: 'PA',
      partyB: 'PB',
      regulators: ['Reg'],
      thresholdDirA: 0,
      thresholdDirB: 0,
      mta: 100_000,
      rounding: 10_000,
      valuationCcy: 'USD',
      postedByA: new Map([['USD', 5_000_000]]),
      postedByB: new Map([['USD', 5_000_000]]),
      state: 'Active',
      lastMarkCid: null,
      isdaMasterAgreementRef: '',
      governingLaw: 'NewYork',
      imAmount: 0,
    }
    const netting: NettingSetEntry = {
      csaCid: 'csa1',
      partyA: 'PA',
      partyB: 'PB',
      swaps: fix.swaps.map((s) => ({
        contractId: s.contractId,
        payload: {
          swapType: 'IRS',
          operator: 'Op',
          partyA: 'PA',
          partyB: 'PB',
          regulators: ['Reg'],
          scheduler: 'Sched',
          notional: String(s.notional),
          instrumentKey: {
            depository: 'D',
            issuer: 'I',
            id: { unpack: s.contractId },
            version: '1',
            holdingStandard: 'TransferableFungible',
          },
        } satisfies SwapWorkflow,
      })),
    }
    const ctx: PricingContext = {
      curve: fix.curve,
      index: fix.index,
      observations: [],
    }
    const mc = await computeMark(csa, netting, {
      asOf: () => '2026-04-17T12:00:00Z',
      resolveSwapConfig: (cid) => buildConfig(fix.swaps.find((s) => s.contractId === cid)!),
      resolveCtx: () => ctx,
    })
    expect(Math.abs(mc.exposure)).toBeLessThan(1)
    expect(mc.asOf).toBe('2026-04-17T12:00:00Z')
    expect(mc.swapPvs).toHaveLength(2)
  })
})
