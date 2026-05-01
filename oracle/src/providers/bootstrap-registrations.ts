/**
 * Boot-time registrations for every built-in OracleProvider.
 *
 * Splits the wiring out of `oracle/src/index.ts` so the entrypoint stays
 * under the project's 300-line ceiling and the registration order is one
 * scannable function. Adding a new provider = one more `registerProvider`
 * call here, plus its concrete-template-id entry.
 *
 * The NYFed back-fill rate cache (`nyfedRateLookup`) is set inside `main()`
 * after async bootstrap; the closure here holds the latest value so the
 * provider's `rateSource` reads it without re-registration.
 */
import type { Config } from 'irsforge-shared-config'
import { IRSFORGE_PROVIDER_INTERFACE_ID } from '../shared/generated/package-ids.js'
import { SOFR_INDEX_RATE_ID } from '../shared/generated/rate-families.js'
import type { State } from '../shared/state.js'
import { CdsStubProvider } from './cds-stub.js'
import { buildDemoStubProvider } from './demo-stub.js'
import { fetchSofrData } from './nyfed/fetcher.js'
import type { NyFedRateLookup } from './nyfed/rate-cache.js'
import { extractSofrIndex, validateSofrResponse } from './nyfed/validator.js'
import { registerProvider } from './registry.js'
import type { OracleProvider } from './types.js'

let nyfedRateLookup: NyFedRateLookup | undefined

/**
 * Wire the resolved NYFed rate cache into the registered NYFed provider's
 * `rateSource`. Called once after `bootstrapNyFedRateLookup` resolves
 * inside `main()`. Reading `rateSource` before this call throws, surfacing
 * a missing bootstrap step instead of silently writing zero rates.
 */
export function setNyFedRateLookup(lookup: NyFedRateLookup | undefined): void {
  nyfedRateLookup = lookup
}

export interface RegisterAllProvidersDeps {
  config: Config
  state: State
}

export function registerAllProviders(deps: RegisterAllProvidersDeps): void {
  const { config, state } = deps
  const observables = config.observables
  const cdsReferenceNames = config.cds?.referenceNames ?? []

  if (observables.IRS.enabled) {
    registerProvider(buildNyFedProvider(config, state))
  }

  if (config.profile === 'demo') {
    registerProvider(buildDemoStubProvider(config))
  }

  const demoCdsStub = config.demo?.cdsStub
  if (
    config.profile === 'demo' &&
    observables.CDS.enabled &&
    cdsReferenceNames.length > 0 &&
    demoCdsStub
  ) {
    registerProvider(
      new CdsStubProvider({
        referenceNames: cdsReferenceNames,
        defaultProb: demoCdsStub.defaultProb,
        recovery: demoCdsStub.recovery,
      }),
    )
  }
}

function buildNyFedProvider(config: Config, state: State): OracleProvider {
  return {
    id: 'nyfed',
    supportedRateIds: [SOFR_INDEX_RATE_ID],
    onchainInterfaceTemplateId: IRSFORGE_PROVIDER_INTERFACE_ID,
    async fetchRate(rateId, date) {
      const data = await fetchSofrData(date, config.oracle.fetchTimeoutMs)
      validateSofrResponse(data, date)
      const value = extractSofrIndex(data)
      state.recordObservation(rateId, date, value)
      return { rateId, effectiveDate: date, value }
    },
    rateSource: (indexId, date) => {
      if (!nyfedRateLookup) {
        throw new Error(
          `daily back-fill requires nyfedRateLookup for NYFed-provided index ${indexId} on ` +
            `${date.toISOString().slice(0, 10)}. Wire a date-keyed Fed SOFR cache via ` +
            'bootstrapNyFedRateLookup before publishDailyWindowsForAllIndices runs.',
        )
      }
      return nyfedRateLookup(indexId, date)
    },
  }
}
