import { describe, expect, it } from 'vitest'
import { type FxSpotLedger, type FxSpotRow, seedFxSpots } from '../../seed/index.js'

function mockLedger(initial: FxSpotRow[] = []) {
  const state: FxSpotRow[] = [...initial]
  const created: Array<{ baseCcy: string; quoteCcy: string; rate: number }> = []
  const updated: Array<{ contractId: string; newRate: number }> = []
  const ledger: FxSpotLedger = {
    async listFxSpots() {
      return state.slice()
    },
    async createFxSpot({ baseCcy, quoteCcy, rate }) {
      state.push({ contractId: `cid-${state.length}`, baseCcy, quoteCcy, rate })
      created.push({ baseCcy, quoteCcy, rate })
    },
    async updateFxSpotRate({ contractId, newRate }) {
      const idx = state.findIndex((r) => r.contractId === contractId)
      if (idx >= 0) state[idx] = { ...state[idx], rate: newRate }
      updated.push({ contractId, newRate })
    },
  }
  return { ledger, created, updated, state }
}

describe('seedFxSpots', () => {
  it('seeds one FxSpot per demo.fxSpots entry', async () => {
    const { ledger, created } = mockLedger()
    await seedFxSpots(ledger, { EURUSD: 1.08, GBPUSD: 1.25 })
    expect(created).toHaveLength(2)
    expect(created.find((c) => c.baseCcy === 'EUR')?.rate).toBe(1.08)
    expect(created.find((c) => c.baseCcy === 'GBP')?.rate).toBe(1.25)
  })

  it('is a no-op when fxSpots is undefined', async () => {
    const { ledger, created, updated } = mockLedger()
    await seedFxSpots(ledger, undefined)
    expect(created).toHaveLength(0)
    expect(updated).toHaveLength(0)
  })

  it('skips pairs whose on-chain rate already matches', async () => {
    const { ledger, created, updated } = mockLedger([
      { contractId: 'cid-existing', baseCcy: 'EUR', quoteCcy: 'USD', rate: 1.08 },
    ])
    await seedFxSpots(ledger, { EURUSD: 1.08 })
    expect(created).toHaveLength(0)
    expect(updated).toHaveLength(0)
  })

  it('exercises UpdateRate when the configured rate drifts', async () => {
    const { ledger, created, updated } = mockLedger([
      { contractId: 'cid-existing', baseCcy: 'EUR', quoteCcy: 'USD', rate: 1.08 },
    ])
    await seedFxSpots(ledger, { EURUSD: 1.1 })
    expect(created).toHaveLength(0)
    expect(updated).toEqual([{ contractId: 'cid-existing', newRate: 1.1 }])
  })

  it('parses 6-char pair keys into baseCcy (first 3) + quoteCcy (last 3)', async () => {
    const { ledger, created } = mockLedger()
    await seedFxSpots(ledger, { EURUSD: 1.08 })
    expect(created[0]).toMatchObject({ baseCcy: 'EUR', quoteCcy: 'USD' })
  })
})
