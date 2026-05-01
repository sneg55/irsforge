/**
 * CdsStubProvider — demo stub for CDS observables.
 *
 * NOT sourced from real credit data. Emits flat demo values for any CDS
 * rate id whose reference name is in the configured allowlist:
 *   CDS/<name>/DefaultProb -> 0.02
 *   CDS/<name>/Recovery    -> 0.40
 *
 * Replace with a real provider (Markit, BVAL, CDX index data) when the
 * platform moves beyond demo scope.
 */
import { IRSFORGE_PROVIDER_INTERFACE_ID } from '../shared/generated/package-ids.js'
import type { OracleProvider, RateObservation } from './types.js'

export interface CdsStubConfig {
  referenceNames: string[]
  /** Flat default-probability emitted for every allowlisted name. */
  defaultProb: number
  /** Flat recovery rate emitted for every allowlisted name. */
  recovery: number
}

const CDS_RATE_ID_RE = /^CDS\/([^/]+)\/(DefaultProb|Recovery)$/

export class CdsStubProvider implements OracleProvider {
  readonly id = 'cds-stub'
  readonly supportedRateIds: string[]
  readonly onchainInterfaceTemplateId = IRSFORGE_PROVIDER_INTERFACE_ID

  private readonly allowed: Set<string>
  private readonly defaultProb: number
  private readonly recovery: number

  constructor(readonly config: CdsStubConfig) {
    this.allowed = new Set(config.referenceNames)
    this.defaultProb = config.defaultProb
    this.recovery = config.recovery
    this.supportedRateIds = config.referenceNames.flatMap((name) => [
      `CDS/${name}/DefaultProb`,
      `CDS/${name}/Recovery`,
    ])
  }

  fetch(rateId: string): Promise<number> {
    const match = CDS_RATE_ID_RE.exec(rateId)
    if (!match) {
      return Promise.reject(new Error(`CdsStubProvider rejects non-CDS rate id: ${rateId}`))
    }
    const [, name, leg] = match
    if (!this.allowed.has(name)) {
      return Promise.reject(new Error(`CdsStubProvider has no data for reference name ${name}`))
    }
    return Promise.resolve(leg === 'DefaultProb' ? this.defaultProb : this.recovery)
  }

  async fetchRate(rateId: string, date: string): Promise<RateObservation> {
    const value = await this.fetch(rateId)
    return { rateId, effectiveDate: date, value }
  }
}
