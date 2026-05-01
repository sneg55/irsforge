import { describe, expect, test, vi } from 'vitest'
import { PartyDirectory } from '../src/core'

const FULL_ID_A = 'PartyA::122020ad6b890abe445eadfb9cdaec3dfa784e8c'
const FULL_ID_B = 'PartyB::122020ad6b890abe445eadfb9cdaec3dfa784e8c'

describe('PartyDirectory', () => {
  describe('displayName — fallback chain', () => {
    test('exact match returns displayName', () => {
      const dir = new PartyDirectory({
        entries: [{ identifier: FULL_ID_A, displayName: 'Goldman Sachs', hint: 'PartyA' }],
      })
      expect(dir.displayName(FULL_ID_A)).toBe('Goldman Sachs')
    })

    test('hint match returns displayName', () => {
      const dir = new PartyDirectory({
        entries: [{ identifier: '', displayName: 'Goldman Sachs', hint: 'PartyA' }],
      })
      expect(dir.displayName(FULL_ID_A)).toBe('Goldman Sachs')
    })

    test('unknown identifier with :: returns hint portion', () => {
      const dir = new PartyDirectory()
      expect(dir.displayName('PartyC::abcdef1234567890')).toBe('PartyC')
    })

    test('unknown identifier without :: returns truncated string', () => {
      const dir = new PartyDirectory()
      expect(dir.displayName('abcdef1234567890abcdef')).toBe('abcdef1234...')
    })

    test('empty string returns empty string', () => {
      const dir = new PartyDirectory()
      expect(dir.displayName('')).toBe('')
    })
  })

  describe('register', () => {
    test('adds new entries', () => {
      const dir = new PartyDirectory()
      dir.register([{ identifier: FULL_ID_A, displayName: 'Goldman Sachs', hint: 'PartyA' }])
      expect(dir.displayName(FULL_ID_A)).toBe('Goldman Sachs')
    })

    test('overwrites existing entry with same identifier', () => {
      const dir = new PartyDirectory({
        entries: [{ identifier: FULL_ID_A, displayName: 'Old Name', hint: 'PartyA' }],
      })
      dir.register([{ identifier: FULL_ID_A, displayName: 'New Name', hint: 'PartyA' }])
      expect(dir.displayName(FULL_ID_A)).toBe('New Name')
    })
  })

  describe('get and entries', () => {
    test('get returns entry by identifier', () => {
      const dir = new PartyDirectory({
        entries: [{ identifier: FULL_ID_A, displayName: 'Goldman Sachs', hint: 'PartyA' }],
      })
      expect(dir.get(FULL_ID_A)).toEqual({
        identifier: FULL_ID_A,
        displayName: 'Goldman Sachs',
        hint: 'PartyA',
      })
    })

    test('get returns undefined for unknown', () => {
      const dir = new PartyDirectory()
      expect(dir.get('unknown')).toBeUndefined()
    })

    test('entries returns all registered entries', () => {
      const dir = new PartyDirectory({
        entries: [
          { identifier: FULL_ID_A, displayName: 'Goldman Sachs', hint: 'PartyA' },
          { identifier: FULL_ID_B, displayName: 'JPMorgan', hint: 'PartyB' },
        ],
      })
      expect(dir.entries()).toHaveLength(2)
    })

    test('entries includes hint-only entries (no identifier)', () => {
      const dir = new PartyDirectory({
        entries: [
          { identifier: '', displayName: 'Goldman Sachs', hint: 'PartyA' },
          { identifier: '', displayName: 'JPMorgan', hint: 'PartyB' },
        ],
      })
      const hints = dir
        .entries()
        .map((e) => e.hint)
        .sort()
      expect(hints).toEqual(['PartyA', 'PartyB'])
    })

    test('entries dedupes identifier-keyed and hint-keyed entries sharing a hint', () => {
      const dir = new PartyDirectory({
        entries: [
          { identifier: FULL_ID_A, displayName: 'Goldman Sachs', hint: 'PartyA' },
          { identifier: '', displayName: 'JPMorgan', hint: 'PartyB' },
        ],
      })
      const entries = dir.entries()
      expect(entries).toHaveLength(2)
      const partyA = entries.find((e) => e.hint === 'PartyA')
      expect(partyA?.identifier).toBe(FULL_ID_A)
    })
  })

  describe('sync', () => {
    test('merges Canton entries into registry', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              result: [
                { identifier: FULL_ID_A, displayName: 'PartyA', isLocal: true },
                { identifier: FULL_ID_B, displayName: 'PartyB', isLocal: true },
              ],
              status: 200,
            }),
        }),
      )

      const dir = new PartyDirectory({ ledgerUrl: 'http://localhost:7575', token: 'test' })
      await dir.sync()

      expect(dir.displayName(FULL_ID_A)).toBe('PartyA')
      expect(dir.displayName(FULL_ID_B)).toBe('PartyB')

      vi.unstubAllGlobals()
    })

    test('static entries take precedence over Canton entries', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              result: [{ identifier: FULL_ID_A, displayName: 'PartyA', isLocal: true }],
              status: 200,
            }),
        }),
      )

      const dir = new PartyDirectory({
        entries: [{ identifier: FULL_ID_A, displayName: 'Goldman Sachs', hint: 'PartyA' }],
        ledgerUrl: 'http://localhost:7575',
        token: 'test',
      })
      await dir.sync()

      // Static entry wins
      expect(dir.displayName(FULL_ID_A)).toBe('Goldman Sachs')

      vi.unstubAllGlobals()
    })
  })
})
