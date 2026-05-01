export interface CachedObservation {
  rateId: string
  effectiveDate: string
  value: number
  fetchedAt: string
}

export interface CachedOvernightRate {
  effectiveDate: string
  percent: number
  fetchedAt: string
}

export interface LastSuccessfulPublish {
  effectiveDate: string
  publishedAt: string
  tenors: number
  skipped: boolean
}

export interface LastPublishError {
  effectiveDate: string
  failedAt: string
  message: string
}

export interface State {
  lastObservation: CachedObservation | null
  lastOvernightRate: CachedOvernightRate | null
  lastSuccessfulPublish: LastSuccessfulPublish | null
  lastPublishError: LastPublishError | null
  nextScheduledRun: string | null
  recordObservation(rateId: string, effectiveDate: string, value: number): void
  recordOvernightRate(effectiveDate: string, percent: number): void
}

function makeState(): State {
  const s: State = {
    lastObservation: null,
    lastOvernightRate: null,
    lastSuccessfulPublish: null,
    lastPublishError: null,
    nextScheduledRun: null,
    recordObservation(rateId, effectiveDate, value) {
      s.lastObservation = {
        rateId,
        effectiveDate,
        value,
        fetchedAt: new Date().toISOString(),
      }
    },
    recordOvernightRate(effectiveDate, percent) {
      s.lastOvernightRate = {
        effectiveDate,
        percent,
        fetchedAt: new Date().toISOString(),
      }
    },
  }
  return s
}

export const state: State = makeState()

/** Reset to initial values — intended for tests only. */
export function resetState(): void {
  state.lastObservation = null
  state.lastOvernightRate = null
  state.lastSuccessfulPublish = null
  state.lastPublishError = null
  state.nextScheduledRun = null
}
