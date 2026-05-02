import { describe, expect, test } from 'vitest'
import { DEFAULT_BACKOFF_MS, pollIntervalWithBackoff } from '../poll-interval'

describe('pollIntervalWithBackoff', () => {
  test('returns the healthy interval when query has no error', () => {
    const fn = pollIntervalWithBackoff(3_000)
    expect(fn({ state: { error: null } })).toBe(3_000)
  })

  test('returns the default backoff (30 s) while query is in error state', () => {
    const fn = pollIntervalWithBackoff(3_000)
    expect(fn({ state: { error: new Error('UNAVAILABLE') } })).toBe(DEFAULT_BACKOFF_MS)
  })

  test('respects a caller-supplied backoff value', () => {
    const fn = pollIntervalWithBackoff(5_000, 60_000)
    expect(fn({ state: { error: new Error('boom') } })).toBe(60_000)
  })

  test('treats truthy non-Error values as failures (defensive — RQ stores whatever is thrown)', () => {
    const fn = pollIntervalWithBackoff(2_000)
    expect(fn({ state: { error: 'some-string-error' } })).toBe(DEFAULT_BACKOFF_MS)
    expect(fn({ state: { error: { message: 'shape' } } })).toBe(DEFAULT_BACKOFF_MS)
  })

  test('returns healthy when error is undefined', () => {
    const fn = pollIntervalWithBackoff(7_000)
    expect(fn({ state: { error: undefined } })).toBe(7_000)
  })
})
