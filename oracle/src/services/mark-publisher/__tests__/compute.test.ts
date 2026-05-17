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
  it('flips PV sign for swaps whose partyA is csa.partyB (reversed orientation)', async () => {
    // Two CSAs holding the same single swap. CSA #1 sees the swap in
    // its natural orientation (swap.partyA == csa.partyA → reversed=false).
    // CSA #2 has the parties flipped (swap.partyA == csa.partyB → reversed=true).
    // The pricer returns the same PV either way; the netting layer must
    // flip the sign for the reversed case so the recorded PVs are
    // mirror images.
    const baseCsa: DecodedCsa = {
      contractId: 'csa-base',
      operator: 'Op',
      partyA: 'PA',
      partyB: 'PB',
      regulators: ['Reg'],
      thresholdDirA: 0,
      thresholdDirB: 0,
      mta: 0,
      rounding: 0,
      valuationCcy: 'USD',
      postedByA: new Map(),
      postedByB: new Map(),
      state: 'Active',
      lastMarkCid: null,
      isdaMasterAgreementRef: '',
      governingLaw: 'NewYork',
      imAmount: 0,
    }
    const swap = fix.swaps[0]
    const baseSwap = {
      contractId: swap.contractId,
      payload: {
        swapType: 'IRS' as const,
        operator: 'Op',
        partyA: 'PA',
        partyB: 'PB',
        regulators: ['Reg'],
        scheduler: 'Sched',
        notional: String(swap.notional),
        instrumentKey: {
          depository: 'D',
          issuer: 'I',
          id: { unpack: swap.contractId },
          version: '1',
          holdingStandard: 'TransferableFungible',
        },
      } satisfies SwapWorkflow,
    }
    const ctx: PricingContext = { curve: fix.curve, index: fix.index, observations: [] }
    // Override the fixed rate to 5% (curve discounts at 4%) so the PV is
    // clearly non-zero. Otherwise both natural and reversed cases price
    // to ~0 and the sign-flip assertion is vacuous.
    const deps = {
      asOf: () => '2026-04-17T12:00:00Z',
      resolveSwapConfig: (cid: string) => {
        const s = fix.swaps.find((x) => x.contractId === cid)!
        return buildConfig({ ...s, fixedRate: 0.05 })
      },
      resolveCtx: () => ctx,
    }

    const natural = await computeMark(
      baseCsa,
      {
        csaCid: 'csa-base',
        partyA: 'PA',
        partyB: 'PB',
        swaps: [{ ...baseSwap, reversed: false }],
      },
      deps,
    )
    const reversed = await computeMark(
      baseCsa,
      {
        csaCid: 'csa-base',
        partyA: 'PA',
        partyB: 'PB',
        swaps: [{ ...baseSwap, reversed: true }],
      },
      deps,
    )

    // Recorded PV under reversed must equal the negation of the natural.
    expect(reversed.swapPvs[0].pv).toBeCloseTo(-natural.swapPvs[0].pv, 6)
    // And the headline exposure (which is -ΣpvA) must flip too.
    expect(reversed.exposure).toBeCloseTo(-natural.exposure, 6)
  })

  it('propagates resolveSwapConfig errors (no silent skip on unsupported swap types)', async () => {
    // A live CCY/FX/ASSET workflow under an active CSA must NOT silently
    // contribute zero to exposure — that would understate the call and
    // could leave the CSA under-collateralised without anyone seeing.
    const csa: DecodedCsa = {
      contractId: 'csa-bad',
      operator: 'Op',
      partyA: 'PA',
      partyB: 'PB',
      regulators: ['Reg'],
      thresholdDirA: 0,
      thresholdDirB: 0,
      mta: 0,
      rounding: 0,
      valuationCcy: 'USD',
      postedByA: new Map(),
      postedByB: new Map(),
      state: 'Active',
      lastMarkCid: null,
      isdaMasterAgreementRef: '',
      governingLaw: 'NewYork',
      imAmount: 0,
    }
    const netting: NettingSetEntry = {
      csaCid: 'csa-bad',
      partyA: 'PA',
      partyB: 'PB',
      swaps: [
        {
          contractId: 'wf-ccy',
          reversed: false,
          payload: {
            swapType: 'CCY',
            operator: 'Op',
            partyA: 'PA',
            partyB: 'PB',
            regulators: ['Reg'],
            scheduler: 'Sched',
            notional: '1000000',
            instrumentKey: {
              depository: 'D',
              issuer: 'I',
              id: { unpack: 'wf-ccy' },
              version: '1',
              holdingStandard: 'TransferableFungible',
            },
          } satisfies SwapWorkflow,
        },
      ],
    }
    const ctx: PricingContext = { curve: fix.curve, index: fix.index, observations: [] }
    await expect(
      computeMark(csa, netting, {
        asOf: () => '2026-04-17T12:00:00Z',
        resolveSwapConfig: () => {
          throw new Error('resolveSwapConfig: CCY deprecated/disabled — not in replay scope')
        },
        resolveCtx: () => ctx,
      }),
    ).rejects.toThrow(/deprecated\/disabled/)
  })

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
        reversed: false,
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
