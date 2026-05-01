export interface RateObservation {
  rateId: string
  effectiveDate: string
  value: number
}

/**
 * Subset of `Config` shape consumed by `onPublishedDaily`. Kept narrow so
 * providers don't need to import the full `Config` type from shared-config.
 */
export interface DailyPublishHookDeps {
  state?: {
    recordObservation(rateId: string, date: string, value: number): void
    recordOvernightRate(date: string, value: number): void
  }
  config: {
    curves?: {
      currencies: Record<string, { projection: { indexId: string } }>
    }
    demo?: {
      stubCurves?: Record<
        string,
        {
          projections?: Record<string, { pillars: { zeroRate: number }[] }>
        }
      >
    }
  }
}

export interface OracleProvider {
  id: string
  supportedRateIds: string[]
  /**
   * Daml interface template id used for on-ledger choice dispatch via
   * `exerciseProviderChoice`. Always the same value across providers —
   * set from `IRSFORGE_PROVIDER_INTERFACE_ID` in the registration site.
   */
  onchainInterfaceTemplateId: string
  /**
   * Optional async rate fetcher. NOT consumed by the daily back-fill or
   * the seed dispatch — those use `rateSource` (sync). Provide `fetchRate`
   * if you want to expose a single-rate HTTP endpoint or run ad-hoc
   * one-off fetches outside the daily window. The NYFed provider uses it
   * via `NyFedSofrService` for live-mode SOFR pulls; the demo stub returns
   * a cached value.
   */
  fetchRate?(rateId: string, date: string): Promise<RateObservation>
  /**
   * Optional: provider-specific rate source for the daily back-fill window.
   * Falls back to the config's demo stub rate if absent.
   */
  rateSource?: (indexId: string, date: Date) => number
  /**
   * Optional: side-effect hook called after a successful daily publish
   * (e.g. update an in-memory rate cache).
   */
  onPublishedDaily?: (
    indexIds: string[],
    asOf: Date,
    windowDays: number,
    deps: DailyPublishHookDeps,
  ) => void
}
