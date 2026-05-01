import { describe, expect, it } from 'vitest'
import { publishDailyWindow } from '../daily-publisher.js'

describe('publishDailyWindow', () => {
  it('creates one Observation per calendar day in the window', async () => {
    const created: Array<{ indexId: string; date: string; rate: number }> = []
    const ledger = {
      createObservation: async (indexId: string, date: Date, rate: number) => {
        created.push({
          indexId,
          date: date.toISOString().slice(0, 10),
          rate,
        })
      },
      listObservations: async () => [],
    }
    const rateSource = (_indexId: string, _date: Date) => 0.0532
    const today = new Date('2026-04-16T00:00:00Z')
    await publishDailyWindow({
      ledger,
      rateSource,
      indexIds: ['USD-SOFR'],
      asOf: today,
      windowDays: 90,
    })
    expect(created).toHaveLength(90)
    expect(created[0].date).toBe('2026-01-16')
    expect(created[89].date).toBe('2026-04-15')
  })

  it('skips dates that already have an Observation', async () => {
    const existing = new Set(['2026-04-14', '2026-04-15'])
    const created: string[] = []
    const ledger = {
      createObservation: async (_i: string, date: Date) => {
        created.push(date.toISOString().slice(0, 10))
      },
      listObservations: async () =>
        Array.from(existing).map((d) => ({
          indexId: 'USD-SOFR',
          date: new Date(d),
          rate: 0,
        })),
    }
    const today = new Date('2026-04-16T00:00:00Z')
    await publishDailyWindow({
      ledger,
      rateSource: () => 0.05,
      indexIds: ['USD-SOFR'],
      asOf: today,
      windowDays: 3, // 2026-04-13, 2026-04-14, 2026-04-15
    })
    expect(created).toEqual(['2026-04-13'])
  })

  it('publishes for every indexId independently', async () => {
    const created: Array<{ indexId: string; date: string; rate: number }> = []
    const ledger = {
      createObservation: async (indexId: string, date: Date, rate: number) => {
        created.push({
          indexId,
          date: date.toISOString().slice(0, 10),
          rate,
        })
      },
      listObservations: async () => [],
    }
    const rateByIndex: Record<string, number> = {
      'USD-SOFR': 0.0532,
      'EUR-ESTR': 0.039,
    }
    await publishDailyWindow({
      ledger,
      rateSource: (indexId, _d) => rateByIndex[indexId] ?? 0,
      indexIds: ['USD-SOFR', 'EUR-ESTR'],
      asOf: new Date('2026-04-16T00:00:00Z'),
      windowDays: 2,
    })
    const sofr = created.filter((c) => c.indexId === 'USD-SOFR')
    const estr = created.filter((c) => c.indexId === 'EUR-ESTR')
    expect(sofr.map((c) => c.date)).toEqual(['2026-04-14', '2026-04-15'])
    expect(estr.map((c) => c.date)).toEqual(['2026-04-14', '2026-04-15'])
    expect(sofr.every((c) => c.rate === 0.0532)).toBe(true)
    expect(estr.every((c) => c.rate === 0.039)).toBe(true)
  })
})
