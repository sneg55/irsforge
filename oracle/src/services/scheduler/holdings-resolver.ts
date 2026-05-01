import type { LedgerClient } from '../../shared/ledger-client.js'
import { TRANSFERABLE_FUNGIBLE_TEMPLATE_ID } from '../../shared/template-ids.js'

export interface InstrumentKey {
  depository: string
  issuer: string
  id: { unpack: string }
  version: string
  holdingStandard: string
}

export interface AccountKey {
  custodian: string
  owner: string
  id: { unpack: string }
}

export interface CcyHoldings {
  currency: string
  instrumentKey: InstrumentKey
  partyAHoldingCid: string
  partyBHoldingCid: string
  partyAAccountKey: AccountKey
  partyBAccountKey: AccountKey
}

interface FungibleRow {
  contractId: string
  payload: {
    instrument: InstrumentKey
    account: AccountKey
    amount: string
  }
}

/**
 * Query every `TransferableFungible` holding and index by (currency,
 * owner). For each currency where both counterparties have a holding,
 * emit one `CcyHoldings` record. Currencies where one side is missing
 * are skipped — no defensive fallback: the `Csa.SettleNetByScheduler`
 * choice throws if a netted-currency is absent from this list, which is
 * the correct failure mode.
 *
 * Holdings with non-zero balance are preferred when multiple exist for
 * the same (ccy, party) — matches the behaviour of the manual settle
 * path in `app/src/features/workspace/ledger/settlement-inputs.ts`.
 */
export async function resolveAllCurrencyHoldings(
  client: LedgerClient,
  partyA: string,
  partyB: string,
): Promise<CcyHoldings[]> {
  const rows = (await client.query(TRANSFERABLE_FUNGIBLE_TEMPLATE_ID)) as FungibleRow[]

  const byCcy = new Map<string, FungibleRow[]>()
  for (const r of rows) {
    const ccy = r.payload.instrument.id.unpack
    if (!byCcy.has(ccy)) byCcy.set(ccy, [])
    byCcy.get(ccy)?.push(r)
  }

  const result: CcyHoldings[] = []
  for (const [ccy, hs] of byCcy) {
    const aHs = hs.filter((h) => h.payload.account.owner === partyA)
    const bHs = hs.filter((h) => h.payload.account.owner === partyB)
    if (aHs.length === 0 || bHs.length === 0) continue

    const aH = pickLargest(aHs)
    const bH = pickLargest(bHs)

    result.push({
      currency: ccy,
      instrumentKey: aH.payload.instrument,
      partyAHoldingCid: aH.contractId,
      partyBHoldingCid: bH.contractId,
      partyAAccountKey: aH.payload.account,
      partyBAccountKey: bH.payload.account,
    })
  }

  return result
}

function pickLargest(hs: FungibleRow[]): FungibleRow {
  return hs.reduce((best, cur) =>
    parseFloat(cur.payload.amount) >= parseFloat(best.payload.amount) ? cur : best,
  )
}
