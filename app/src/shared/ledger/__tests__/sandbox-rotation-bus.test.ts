import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { type SandboxRotationEvent, sandboxRotationBus } from '../sandbox-rotation-bus'

const CANARY = 'pkg:Oracle.FloatingRateIndex:FloatingRateIndex'

let now = 0

beforeEach(() => {
  now = 1_000_000
  sandboxRotationBus.resetForTesting()
  sandboxRotationBus.setClockForTesting(() => now)
})

afterEach(() => {
  sandboxRotationBus.resetForTesting()
})

describe('sandboxRotationBus', () => {
  test('does not fire when canary has never been observed populated', () => {
    const seen: SandboxRotationEvent[] = []
    sandboxRotationBus.subscribe((e) => seen.push(e))
    sandboxRotationBus.recordCanaryCount(CANARY, 0)
    expect(seen).toEqual([])
  })

  test('fires canary-empty when count drops from positive to zero', () => {
    const seen: SandboxRotationEvent[] = []
    sandboxRotationBus.subscribe((e) => seen.push(e))
    sandboxRotationBus.recordCanaryCount(CANARY, 5)
    sandboxRotationBus.recordCanaryCount(CANARY, 0)
    expect(seen).toHaveLength(1)
    expect(seen[0]?.reason).toBe('canary-empty')
  })

  test('fires health-reconnect on recordHealthReconnect', () => {
    const seen: SandboxRotationEvent[] = []
    sandboxRotationBus.subscribe((e) => seen.push(e))
    sandboxRotationBus.recordHealthReconnect()
    expect(seen[0]?.reason).toBe('health-reconnect')
  })

  test('30s cooldown dedups multiple signals from the same rotation', () => {
    const seen: SandboxRotationEvent[] = []
    sandboxRotationBus.subscribe((e) => seen.push(e))
    sandboxRotationBus.recordCanaryCount(CANARY, 3)
    sandboxRotationBus.recordCanaryCount(CANARY, 0)
    sandboxRotationBus.recordHealthReconnect()
    now += 5_000
    sandboxRotationBus.recordHealthReconnect()
    expect(seen).toHaveLength(1)
  })

  test('after cooldown elapses a fresh rotation can fire again', () => {
    const seen: SandboxRotationEvent[] = []
    sandboxRotationBus.subscribe((e) => seen.push(e))
    sandboxRotationBus.recordCanaryCount(CANARY, 3)
    sandboxRotationBus.recordCanaryCount(CANARY, 0)
    now += 31_000
    // Need to re-establish a populated baseline before the next zero
    // can fire — the bus clears baselines on every rotation.
    sandboxRotationBus.recordCanaryCount(CANARY, 3)
    sandboxRotationBus.recordCanaryCount(CANARY, 0)
    expect(seen).toHaveLength(2)
  })

  test('unsubscribe stops further notifications', () => {
    const seen: SandboxRotationEvent[] = []
    const unsub = sandboxRotationBus.subscribe((e) => seen.push(e))
    sandboxRotationBus.recordCanaryCount(CANARY, 3)
    sandboxRotationBus.recordCanaryCount(CANARY, 0)
    expect(seen).toHaveLength(1)
    unsub()
    now += 31_000
    sandboxRotationBus.recordCanaryCount(CANARY, 3)
    sandboxRotationBus.recordCanaryCount(CANARY, 0)
    expect(seen).toHaveLength(1)
  })

  test('one bad listener does not block the others', () => {
    const log: string[] = []
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {})
    sandboxRotationBus.subscribe(() => {
      throw new Error('boom')
    })
    sandboxRotationBus.subscribe(() => log.push('ok'))
    sandboxRotationBus.recordHealthReconnect()
    expect(log).toEqual(['ok'])
    consoleErr.mockRestore()
  })
})
