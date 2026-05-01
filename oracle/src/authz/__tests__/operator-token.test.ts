import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createLedgerClient, loadOperatorToken } from '../operator-token'

describe('loadOperatorToken', () => {
  const original = process.env.OPERATOR_TOKEN
  beforeEach(() => {
    delete process.env.OPERATOR_TOKEN
  })
  afterEach(() => {
    if (original !== undefined) process.env.OPERATOR_TOKEN = original
  })

  it('throws when OPERATOR_TOKEN is empty/unset', () => {
    expect(() => loadOperatorToken()).toThrow(/OPERATOR_TOKEN/)
  })

  it('returns the token when set', () => {
    process.env.OPERATOR_TOKEN = 'tok-123'
    expect(loadOperatorToken()).toBe('tok-123')
  })
})

describe('createLedgerClient', () => {
  const original = process.env.OPERATOR_TOKEN
  afterEach(() => {
    if (original !== undefined) process.env.OPERATOR_TOKEN = original
  })

  it('builds a client bound to the loaded token', () => {
    process.env.OPERATOR_TOKEN = 'tok-xyz'
    const client = createLedgerClient()
    expect(client).toBeDefined()
  })
})
