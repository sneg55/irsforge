import { describe, expect, it, vi } from 'vitest'
import { createLogger } from '../logger'

describe('createLogger', () => {
  it('info() writes single-line JSON to stdout with ts + level', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const logger = createLogger()
    logger.info({ event: 'test', n: 42 })
    expect(spy).toHaveBeenCalledTimes(1)
    const payload = JSON.parse(spy.mock.calls[0][0] as string)
    expect(payload.level).toBe('info')
    expect(payload.event).toBe('test')
    expect(payload.n).toBe(42)
    expect(typeof payload.ts).toBe('string')
    expect(Number.isFinite(Date.parse(payload.ts))).toBe(true)
    spy.mockRestore()
  })

  it('error() writes to stderr with level=error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const logger = createLogger()
    logger.error({ event: 'boom', msg: 'nope' })
    const payload = JSON.parse(spy.mock.calls[0][0] as string)
    expect(payload.level).toBe('error')
    expect(payload.event).toBe('boom')
    spy.mockRestore()
  })
})
