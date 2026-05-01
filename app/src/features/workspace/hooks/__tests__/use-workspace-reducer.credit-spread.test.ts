import { describe, expect, it } from 'vitest'
import { initialWorkspaceState, workspaceReducer } from '../use-workspace-reducer'

describe('SET_CREDIT_SPREAD', () => {
  it('default creditSpread is 0.02 (200bp)', () => {
    const state = initialWorkspaceState('d')
    expect(state.creditSpread).toBe(0.02)
  })

  it('updates creditSpread and leaves other state untouched', () => {
    const state = initialWorkspaceState('d')
    const next = workspaceReducer(state, { type: 'SET_CREDIT_SPREAD', value: 0.05 })
    expect(next.creditSpread).toBe(0.05)
    expect(next.swapType).toBe(state.swapType)
    expect(next.mode).toBe(state.mode)
    expect(next.legs).toBe(state.legs)
  })

  it('HYDRATE_FROM_DRAFT preserves creditSpread from config', () => {
    const state = initialWorkspaceState('d')
    const maturity = new Date('2031-04-21')
    const next = workspaceReducer(state, {
      type: 'HYDRATE_FROM_DRAFT',
      draftId: 'draft-1',
      config: {
        type: 'CDS',
        tradeDate: new Date('2026-04-21'),
        effectiveDate: new Date('2026-04-21'),
        maturityDate: maturity,
        creditSpread: 0.03,
        legs: [
          {
            legType: 'fixed',
            direction: 'pay',
            currency: 'USD',
            notional: 10_000_000,
            rate: 0.01,
            dayCount: 'ACT_360',
            schedule: {
              startDate: new Date('2026-04-21'),
              endDate: maturity,
              frequency: 'Quarterly',
            },
          },
          { legType: 'protection', direction: 'receive', notional: 10_000_000, recoveryRate: 0.4 },
        ],
      },
    })
    expect(next.creditSpread).toBe(0.03)
  })

  it('HYDRATE_FROM_DRAFT defaults to 0.02 when config.creditSpread is absent', () => {
    const state = initialWorkspaceState('d')
    const maturity = new Date('2031-04-21')
    const next = workspaceReducer(state, {
      type: 'HYDRATE_FROM_DRAFT',
      draftId: 'draft-2',
      config: {
        type: 'CDS',
        tradeDate: new Date('2026-04-21'),
        effectiveDate: new Date('2026-04-21'),
        maturityDate: maturity,
        legs: [
          {
            legType: 'fixed',
            direction: 'pay',
            currency: 'USD',
            notional: 10_000_000,
            rate: 0.01,
            dayCount: 'ACT_360',
            schedule: {
              startDate: new Date('2026-04-21'),
              endDate: maturity,
              frequency: 'Quarterly',
            },
          },
          { legType: 'protection', direction: 'receive', notional: 10_000_000, recoveryRate: 0.4 },
        ],
      },
    })
    expect(next.creditSpread).toBe(0.02)
  })
})
