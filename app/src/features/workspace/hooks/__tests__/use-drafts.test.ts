import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, test } from 'vitest'
import type { SwapConfig } from '../../types'
import { useDrafts } from '../use-drafts'

function makeConfig(): SwapConfig {
  return {
    type: 'IRS',
    legs: [
      {
        legType: 'fixed',
        direction: 'receive' as const,
        currency: 'USD',
        notional: 10_000_000,
        rate: 0.045,
        dayCount: 'ACT_360',
        schedule: {
          startDate: new Date('2026-04-03T00:00:00.000Z'),
          endDate: new Date('2028-04-03T00:00:00.000Z'),
          frequency: 'Quarterly',
        },
      },
      {
        legType: 'float',
        direction: 'pay' as const,
        currency: 'USD',
        notional: 10_000_000,
        indexId: 'USD-SOFR',
        spread: 0,
        dayCount: 'ACT_360',
        schedule: {
          startDate: new Date('2026-04-03T00:00:00.000Z'),
          endDate: new Date('2028-04-03T00:00:00.000Z'),
          frequency: 'Quarterly',
        },
      },
    ],
    tradeDate: new Date('2026-04-01T00:00:00.000Z'),
    effectiveDate: new Date('2026-04-03T00:00:00.000Z'),
    maturityDate: new Date('2028-04-03T00:00:00.000Z'),
  }
}

describe('useDrafts save/load roundtrip', () => {
  beforeEach(() => localStorage.clear())

  test('Dates survive serialize → localStorage → deserialize', async () => {
    const { result } = renderHook(() => useDrafts())
    const cfg = makeConfig()

    act(() => result.current.saveDraft('d-1', cfg))
    // saveDraft is debounced 500ms; wait it out.
    await new Promise((r) => setTimeout(r, 600))

    const loaded = result.current.loadDraft('d-1')
    expect(loaded).not.toBeNull()
    expect(loaded!.tradeDate).toBeInstanceOf(Date)
    expect(loaded!.effectiveDate).toBeInstanceOf(Date)
    expect(loaded!.maturityDate).toBeInstanceOf(Date)
    expect(loaded!.maturityDate.toISOString()).toBe('2028-04-03T00:00:00.000Z')

    const leg0 = loaded!.legs[0]
    expect('schedule' in leg0 && leg0.schedule.endDate).toBeInstanceOf(Date)
  })

  test('loadDraft returns null when key does not exist', () => {
    const { result } = renderHook(() => useDrafts())
    expect(result.current.loadDraft('nope')).toBeNull()
  })

  test('loadDraft returns null when stored payload is corrupted JSON', () => {
    localStorage.setItem('irsforge:draft:broken', '{not-json')
    const { result } = renderHook(() => useDrafts())
    expect(result.current.loadDraft('broken')).toBeNull()
  })

  test('listDrafts skips corrupted entries and sorts by lastModified desc', () => {
    localStorage.setItem(
      'irsforge:draft:old',
      JSON.stringify({ config: '{}', type: 'IRS', lastModified: 100, notional: 0 }),
    )
    localStorage.setItem(
      'irsforge:draft:new',
      JSON.stringify({ config: '{}', type: 'CDS', lastModified: 200, notional: 500 }),
    )
    localStorage.setItem('irsforge:draft:corrupt', '{not-json')
    // Non-prefixed key must be ignored.
    localStorage.setItem('other-key', 'whatever')

    const { result } = renderHook(() => useDrafts())
    const list = result.current.listDrafts()
    expect(list.map((d) => d.draftId)).toEqual(['new', 'old'])
    expect(list[0].type).toBe('CDS')
    expect(list[0].notional).toBe(500)
  })

  test('deleteDraft removes only the targeted key', () => {
    localStorage.setItem(
      'irsforge:draft:a',
      JSON.stringify({ config: '{}', type: 'IRS', lastModified: 1, notional: 0 }),
    )
    localStorage.setItem(
      'irsforge:draft:b',
      JSON.stringify({ config: '{}', type: 'IRS', lastModified: 2, notional: 0 }),
    )
    const { result } = renderHook(() => useDrafts())
    result.current.deleteDraft('a')
    expect(localStorage.getItem('irsforge:draft:a')).toBeNull()
    expect(localStorage.getItem('irsforge:draft:b')).not.toBeNull()
  })

  test('deleteAllDrafts removes every prefixed key, leaves others alone', () => {
    localStorage.setItem(
      'irsforge:draft:a',
      JSON.stringify({ config: '{}', type: 'IRS', lastModified: 1, notional: 0 }),
    )
    localStorage.setItem(
      'irsforge:draft:b',
      JSON.stringify({ config: '{}', type: 'OIS', lastModified: 2, notional: 0 }),
    )
    localStorage.setItem('other-key', 'keep-me')

    const { result } = renderHook(() => useDrafts())
    result.current.deleteAllDrafts()
    expect(localStorage.getItem('irsforge:draft:a')).toBeNull()
    expect(localStorage.getItem('irsforge:draft:b')).toBeNull()
    expect(localStorage.getItem('other-key')).toBe('keep-me')
  })

  test('generateDraftId returns a unique string each call', () => {
    const { result } = renderHook(() => useDrafts())
    const a = result.current.generateDraftId()
    const b = result.current.generateDraftId()
    expect(typeof a).toBe('string')
    expect(a.length).toBeGreaterThan(0)
    expect(a).not.toBe(b)
  })

  test('saveDraft debounces — rapid calls write only the final config', async () => {
    const { result } = renderHook(() => useDrafts())
    const cfg1 = makeConfig()
    const cfg2 = { ...makeConfig(), tradeDate: new Date('2026-05-01T00:00:00.000Z') }
    act(() => result.current.saveDraft('dbg', cfg1))
    act(() => result.current.saveDraft('dbg', cfg2))
    await new Promise((r) => setTimeout(r, 600))
    const loaded = result.current.loadDraft('dbg')
    expect(loaded!.tradeDate.toISOString()).toBe('2026-05-01T00:00:00.000Z')
  })

  test('legacy drafts with bare ISO-string dates still load as Date objects', () => {
    // Emulate a draft written before the replacer fix: dates as plain ISO strings.
    const legacy = {
      config: JSON.stringify({
        type: 'IRS',
        legs: [],
        tradeDate: '2026-04-01T00:00:00.000Z',
        effectiveDate: '2026-04-03T00:00:00.000Z',
        maturityDate: '2028-04-03T00:00:00.000Z',
      }),
      type: 'IRS',
      lastModified: Date.now(),
      notional: 0,
    }
    localStorage.setItem('irsforge:draft:legacy', JSON.stringify(legacy))

    const { result } = renderHook(() => useDrafts())
    const loaded = result.current.loadDraft('legacy')
    expect(loaded!.tradeDate).toBeInstanceOf(Date)
    expect(loaded!.maturityDate).toBeInstanceOf(Date)
    expect(loaded!.maturityDate.toISOString()).toBe('2028-04-03T00:00:00.000Z')
  })
})
