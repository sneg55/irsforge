import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ENV } from '../env.js'

describe('ENV getters', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    // Wipe the keys ENV reads so defaults win; tests that need a value
    // set it explicitly below.
    delete process.env.LEDGER_HOST
    delete process.env.LEDGER_PORT
    delete process.env.ORACLE_MODE
    delete process.env.ORACLE_SCHEDULE_CRON
    delete process.env.ORACLE_SCHEDULE_TZ
    delete process.env.MARK_PUBLISHER_CRON
    delete process.env.OPERATOR_TOKEN
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('applies documented defaults when env vars are unset', () => {
    expect(ENV.LEDGER_HOST()).toBe('localhost')
    expect(ENV.LEDGER_PORT()).toBe(7575)
    expect(ENV.MODE()).toBe('demo')
    expect(ENV.SCHEDULE_CRON()).toBe('30 8 * * 1-5')
    expect(ENV.SCHEDULE_TZ()).toBe('America/New_York')
    expect(ENV.MARK_PUBLISHER_CRON()).toBe('15 */1 * * * *')
    expect(ENV.OPERATOR_TOKEN()).toBe('')
  })

  it('reads the value from process.env when set', () => {
    process.env.LEDGER_HOST = 'canton.example'
    process.env.LEDGER_PORT = '9999'
    process.env.ORACLE_MODE = 'live'
    expect(ENV.LEDGER_HOST()).toBe('canton.example')
    expect(ENV.LEDGER_PORT()).toBe(9999)
    expect(ENV.MODE()).toBe('live')
  })
})
