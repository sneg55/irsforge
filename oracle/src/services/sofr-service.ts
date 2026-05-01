import { buildCurveFromResponse } from '../providers/nyfed/curve-builder.js'
import type { CurvePoint, NYFedAllRatesResponse } from '../providers/nyfed/types.js'
import {
  extractSofrIndex,
  extractSofrOvernight,
  validateSofrResponse,
} from '../providers/nyfed/validator.js'
import type { RateObservation } from '../providers/types.js'
import { SOFR_INDEX_RATE_ID } from '../shared/generated/rate-families.js'
import type { State } from '../shared/state.js'

export type SofrFetcher = (date: string) => Promise<NYFedAllRatesResponse>

export interface SofrService {
  fetchAndBuildCurve(effectiveDate: string): Promise<CurvePoint[]>
  fetchSingleRate(rateId: string, effectiveDate: string): Promise<RateObservation>
}

export interface SofrServiceDeps {
  fetcher: SofrFetcher
  state: State
}

export class NyFedSofrService implements SofrService {
  constructor(private readonly deps: SofrServiceDeps) {}

  async fetchAndBuildCurve(effectiveDate: string): Promise<CurvePoint[]> {
    const data = await this.deps.fetcher(effectiveDate)
    validateSofrResponse(data, effectiveDate)
    const indexValue = extractSofrIndex(data)
    this.deps.state.recordObservation(SOFR_INDEX_RATE_ID, effectiveDate, indexValue)
    this.deps.state.recordOvernightRate(effectiveDate, extractSofrOvernight(data))
    return buildCurveFromResponse(data)
  }

  async fetchSingleRate(rateId: string, effectiveDate: string): Promise<RateObservation> {
    const data = await this.deps.fetcher(effectiveDate)
    validateSofrResponse(data, effectiveDate)
    const indexValue = extractSofrIndex(data)
    this.deps.state.recordObservation(rateId, effectiveDate, indexValue)
    this.deps.state.recordOvernightRate(effectiveDate, extractSofrOvernight(data))
    return { rateId, effectiveDate, value: indexValue }
  }
}
