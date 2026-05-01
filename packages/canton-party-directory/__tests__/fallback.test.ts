import { describe, expect, test } from 'vitest'
import { extractHint, getInitials, shortenIdentifier, truncate } from '../src/fallback'

describe('extractHint', () => {
  test('extracts hint before :: separator', () => {
    expect(extractHint('PartyA::122020ad6b890abe')).toBe('PartyA')
  })
  test('returns full string if no :: separator', () => {
    expect(extractHint('PartyA')).toBe('PartyA')
  })
  test('handles empty string', () => {
    expect(extractHint('')).toBe('')
  })
  test('handles multiple :: separators', () => {
    expect(extractHint('Party::ns1::ns2')).toBe('Party')
  })
})

describe('truncate', () => {
  test('truncates long strings with ellipsis', () => {
    expect(truncate('122020ad6b890abe445eadfb', 10)).toBe('122020ad6b...')
  })
  test('does not truncate short strings', () => {
    expect(truncate('short', 10)).toBe('short')
  })
  test('handles exact length', () => {
    expect(truncate('exactly10!', 10)).toBe('exactly10!')
  })
})

describe('shortenIdentifier', () => {
  test('keeps hint and shortens fingerprint as first12…last12', () => {
    const id =
      'PartyA::12205c5ea0409e4f9d8a6b7c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a132e233912f20'
    expect(shortenIdentifier(id)).toBe('PartyA::12205c5ea040…32e233912f20')
  })
  test('returns identifier as-is when fingerprint is short', () => {
    expect(shortenIdentifier('PartyA::abc123')).toBe('PartyA::abc123')
  })
  test('shortens raw fingerprint with no hint', () => {
    const fp = '12205c5ea0409e4f9d8a6b7c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a132e233912f20'
    expect(shortenIdentifier(fp)).toBe('12205c5ea040…32e233912f20')
  })
})

describe('getInitials', () => {
  test('extracts initials from multi-word name', () => {
    expect(getInitials('Goldman Sachs')).toBe('GS')
  })
  test('extracts first two chars from single word', () => {
    expect(getInitials('Operator')).toBe('OP')
  })
  test('handles empty string', () => {
    expect(getInitials('')).toBe('')
  })
  test('limits to 2 characters', () => {
    expect(getInitials('A B C D')).toBe('AB')
  })
})
