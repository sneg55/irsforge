import { describe, expect, it } from 'vitest'
import { buildSnapshot } from '../snapshot.js'

describe('buildSnapshot', () => {
  it('emits sorted JSON for stable hashing', () => {
    const a = buildSnapshot({
      curveCids: ['b', 'a'],
      indexCids: ['y', 'x'],
      observationCutoff: '2026-04-17T12:00:00Z',
      swapCids: ['s2', 's1'],
    })
    const b = buildSnapshot({
      curveCids: ['a', 'b'],
      indexCids: ['x', 'y'],
      observationCutoff: '2026-04-17T12:00:00Z',
      swapCids: ['s1', 's2'],
    })
    expect(a).toBe(b)
    const parsed = JSON.parse(a)
    expect(parsed.curveCids).toEqual(['a', 'b'])
    expect(parsed.indexCids).toEqual(['x', 'y'])
    expect(parsed.swapCids).toEqual(['s1', 's2'])
  })

  it('omits Phase 6 optional fields entirely when unset (legacy snapshots stay byte-identical)', () => {
    const s = buildSnapshot({
      curveCids: ['a'],
      indexCids: ['x'],
      observationCutoff: '2026-04-17T12:00:00Z',
      swapCids: ['s1'],
    })
    const parsed = JSON.parse(s)
    expect('bookCurveCids' in parsed).toBe(false)
    expect('fxSpotCids' in parsed).toBe(false)
    expect('cdsCurveCids' in parsed).toBe(false)
  })

  it('includes + sorts fxSpotCids when present', () => {
    const s = buildSnapshot({
      curveCids: ['a'],
      indexCids: ['x'],
      observationCutoff: '2026-04-17T12:00:00Z',
      swapCids: ['s1'],
      fxSpotCids: ['fx2', 'fx1'],
    })
    const parsed = JSON.parse(s)
    expect(parsed.fxSpotCids).toEqual(['fx1', 'fx2'])
  })

  it('includes + sorts bookCurveCids and cdsCurveCids when present', () => {
    const s = buildSnapshot({
      curveCids: ['a'],
      indexCids: ['x'],
      observationCutoff: '2026-04-17T12:00:00Z',
      swapCids: ['s1'],
      bookCurveCids: ['bk2', 'bk1'],
      cdsCurveCids: ['c2', 'c1'],
    })
    const parsed = JSON.parse(s)
    expect(parsed.bookCurveCids).toEqual(['bk1', 'bk2'])
    expect(parsed.cdsCurveCids).toEqual(['c1', 'c2'])
  })
})
