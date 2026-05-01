import { describe, expect, test } from 'vitest'
import { streamPhase } from '../use-stream-phase'

describe('streamPhase', () => {
  test('idle + no data → initial (subscription not yet active but caller expects data)', () => {
    expect(streamPhase('idle', false)).toBe('initial')
  })

  test('connecting + no data → initial', () => {
    expect(streamPhase('connecting', false)).toBe('initial')
  })

  test('connecting + has data → reconnecting', () => {
    expect(streamPhase('connecting', true)).toBe('reconnecting')
  })

  test('open + no data → live (stream is connected, absence of data is not loading)', () => {
    expect(streamPhase('open', false)).toBe('live')
  })

  test('open + has data → live', () => {
    expect(streamPhase('open', true)).toBe('live')
  })

  test('closed + no data → initial (never connected)', () => {
    expect(streamPhase('closed', false)).toBe('initial')
  })

  test('closed + has data → reconnecting (backoff loop)', () => {
    expect(streamPhase('closed', true)).toBe('reconnecting')
  })

  test('fallback → disconnected (gave up after MAX_RETRIES)', () => {
    expect(streamPhase('fallback', false)).toBe('disconnected')
    expect(streamPhase('fallback', true)).toBe('disconnected')
  })
})
