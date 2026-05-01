import type { LedgerClient } from '../../shared/ledger-client.js'
import { CASH_SETUP_RECORD_TEMPLATE_ID } from '../../shared/template-ids.js'
import type { AccountKey, InstrumentKey } from './holdings-resolver.js'

export interface SetupDiscovery {
  schedulerLifecycleRuleCid: string
  settlementFactoryCid: string
  routeProviderCid: string
  eventFactoryCid: string
  /**
   * Default-currency ("usd") instrument key + demo-pair account keys —
   * the `Mature` choice demands these verbatim. In a single-pair
   * sandbox CashSetupRecord carries exactly what we need; the
   * multi-pair production topology would resolve these per-CSA.
   */
  defaultCurrencyInstrumentKey: InstrumentKey
  partyAAccountKey: AccountKey
  partyBAccountKey: AccountKey
}

interface CashSetupRecordPayload {
  schedulerLifecycleRuleCid?: string
  lifecycleRuleCid?: string
  settlementFactoryCid: string
  routeProviderCid: string
  eventFactoryCid: string
  defaultCurrencyCode: string
  currencies: [string, InstrumentKey][]
  partyAAccountKey: AccountKey
  partyBAccountKey: AccountKey
}

/**
 * Read the `CashSetupRecord` directory contract once at scheduler boot
 * so every tick call-site uses the same plumbing cids. Pre-C1 ledgers
 * omit `schedulerLifecycleRuleCid`; we fail loudly rather than fall back
 * to `lifecycleRuleCid` (operator rule) because the scheduler JWT lacks
 * operator authority and Evolve through the operator rule would fail
 * mid-tick instead of at boot.
 */
export async function discoverSetup(client: LedgerClient): Promise<SetupDiscovery> {
  const rows = (await client.query(CASH_SETUP_RECORD_TEMPLATE_ID)) as Array<{
    contractId: string
    payload: CashSetupRecordPayload
  }>

  if (rows.length === 0) {
    throw new Error('discoverSetup: no CashSetupRecord on ledger — is Setup.Init complete?')
  }

  const csr = rows[0].payload
  if (!csr.schedulerLifecycleRuleCid) {
    throw new Error(
      'discoverSetup: CashSetupRecord.schedulerLifecycleRuleCid missing — did Stage C1 ship?',
    )
  }

  const defaultCurrencyInstrumentKey = csr.currencies.find(
    ([code]) => code === csr.defaultCurrencyCode,
  )?.[1]
  if (!defaultCurrencyInstrumentKey) {
    throw new Error(
      `discoverSetup: CashSetupRecord.currencies missing defaultCurrencyCode "${csr.defaultCurrencyCode}"`,
    )
  }

  return {
    schedulerLifecycleRuleCid: csr.schedulerLifecycleRuleCid,
    settlementFactoryCid: csr.settlementFactoryCid,
    routeProviderCid: csr.routeProviderCid,
    eventFactoryCid: csr.eventFactoryCid,
    defaultCurrencyInstrumentKey,
    partyAAccountKey: csr.partyAAccountKey,
    partyBAccountKey: csr.partyBAccountKey,
  }
}
