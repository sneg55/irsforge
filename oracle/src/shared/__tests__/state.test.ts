import { beforeEach, describe, expect, it } from 'vitest'
import { resetState, state } from '../state'

describe('state', () => {
  beforeEach(() => resetState())

  it('initial values are null', () => {
    expect(state.lastObservation).toBeNull()
    expect(state.lastOvernightRate).toBeNull()
    expect(state.lastSuccessfulPublish).toBeNull()
    expect(state.lastPublishError).toBeNull()
    expect(state.nextScheduledRun).toBeNull()
  })

  it('recordObservation sets lastObservation with fetchedAt timestamp', () => {
    state.recordObservation('SOFR/INDEX', '2026-04-13', 5.28)
    expect(state.lastObservation).not.toBeNull()
    expect(state.lastObservation!.rateId).toBe('SOFR/INDEX')
    expect(state.lastObservation!.effectiveDate).toBe('2026-04-13')
    expect(state.lastObservation!.value).toBe(5.28)
    expect(typeof state.lastObservation!.fetchedAt).toBe('string')
  })

  it('recordOvernightRate sets lastOvernightRate with fetchedAt timestamp', () => {
    state.recordOvernightRate('2026-04-13', 5.33)
    expect(state.lastOvernightRate).not.toBeNull()
    expect(state.lastOvernightRate!.effectiveDate).toBe('2026-04-13')
    expect(state.lastOvernightRate!.percent).toBe(5.33)
    expect(typeof state.lastOvernightRate!.fetchedAt).toBe('string')
  })

  it('resetState clears everything', () => {
    state.recordObservation('X', 'Y', 1)
    state.recordOvernightRate('Y', 5)
    state.lastSuccessfulPublish = {
      effectiveDate: 'x',
      publishedAt: 'y',
      tenors: 1,
      skipped: false,
    }
    state.lastPublishError = { effectiveDate: 'x', failedAt: 'y', message: 'z' }
    resetState()
    expect(state.lastObservation).toBeNull()
    expect(state.lastOvernightRate).toBeNull()
    expect(state.lastSuccessfulPublish).toBeNull()
    expect(state.lastPublishError).toBeNull()
  })
})
