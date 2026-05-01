import type { LedgerClient } from '@/shared/ledger/client'
import { partyMatchesHint } from '@/shared/ledger/party-match'
import { EFFECT_TEMPLATE_ID, TRANSFERABLE_FUNGIBLE_TEMPLATE_ID } from '@/shared/ledger/template-ids'
import type {
  AccountKey,
  CashSetupRecord,
  Effect,
  FungibleHolding,
  InstrumentKey,
} from '@/shared/ledger/types'
import { findCurrencyKey } from '@/shared/ledger/types'

/**
 * Resolve the default-currency instrument key from a CashSetupRecord.
 * The new shape carries a `currencies: [[code, key], ...]` tuple-array
 * plus a `defaultCurrencyCode` pointer (replacing the single-USD
 * `usdInstrumentKey` field).
 */
function resolveDefaultCurrencyKey(record: CashSetupRecord): InstrumentKey {
  const key = findCurrencyKey(record.currencies, record.defaultCurrencyCode)
  if (!key) {
    throw new Error(
      `CashSetupRecord.defaultCurrencyCode "${record.defaultCurrencyCode}" not in currencies`,
    )
  }
  return key
}

type ContractResult<T> = { contractId: string; payload: T }

export interface SettlementInputs {
  effectCids: string[]
  settlementFactoryCid: string
  routeProviderCid: string
  partyAHoldingCid: string
  partyBHoldingCid: string
  partyAAccountKey: AccountKey
  partyBAccountKey: AccountKey
  usdInstrumentKey: InstrumentKey
}

export async function resolveSettlementInputs(
  client: LedgerClient,
  args: { workflowContractId: string; partyA: string; partyB: string },
): Promise<SettlementInputs> {
  const [cashRecord] = await client.query<ContractResult<CashSetupRecord>>(
    'Setup.CashSetup:CashSetupRecord',
  )
  if (!cashRecord) throw new Error('Cash infrastructure not provisioned')

  const usdInstrumentKey = resolveDefaultCurrencyKey(cashRecord.payload)
  const usdId = usdInstrumentKey.id.unpack

  const effects = await client.query<ContractResult<Effect>>(EFFECT_TEMPLATE_ID)
  // An effect is "relevant" when its consumed or produced quantities include
  // USD — i.e., it represents a cashflow that needs settling. The target
  // instrument is the IRS (being evolved), not USD directly, so the old
  // `targetInstrument.id === usdId` filter never matched production effects.
  const touchesUsd = (q: Array<{ unit: { id: { unpack: string } } }> | undefined): boolean =>
    (q ?? []).some((x) => x.unit.id.unpack === usdId)
  // Effect payloads have two quantity lists. The on-ledger field names
  // are `otherProduced` / `otherConsumed` (the lifecycle-v4 schema);
  // the older names `producedQuantities` / `consumedQuantities` are kept
  // as fallbacks for any stale effect contracts.
  const produced = (e: ContractResult<Effect>) =>
    ((e.payload as unknown as { otherProduced?: unknown }).otherProduced as
      | Array<{ unit: { id: { unpack: string } } }>
      | undefined) ?? e.payload.producedQuantities
  const consumed = (e: ContractResult<Effect>) =>
    ((e.payload as unknown as { otherConsumed?: unknown }).otherConsumed as
      | Array<{ unit: { id: { unpack: string } } }>
      | undefined) ?? e.payload.consumedQuantities
  const relevant = effects.filter((e) => touchesUsd(produced(e)) || touchesUsd(consumed(e)))
  if (relevant.length === 0) throw new Error('No effects to settle')

  const holdings = await client.query<ContractResult<FungibleHolding>>(
    TRANSFERABLE_FUNGIBLE_TEMPLATE_ID,
  )
  const pickFor = (partyHint: string): string => {
    const usd = holdings.filter(
      (h) =>
        h.payload.instrument.id.unpack === usdId &&
        partyMatchesHint(h.payload.account.owner, partyHint),
    )
    if (usd.length === 0) throw new Error(`No USD holding for ${partyHint}`)
    return usd.reduce((a, b) =>
      parseFloat(a.payload.amount) >= parseFloat(b.payload.amount) ? a : b,
    ).contractId
  }

  return {
    effectCids: relevant.map((e) => e.contractId),
    settlementFactoryCid: cashRecord.payload.settlementFactoryCid,
    routeProviderCid: cashRecord.payload.routeProviderCid,
    partyAHoldingCid: pickFor(args.partyA),
    partyBHoldingCid: pickFor(args.partyB),
    partyAAccountKey: cashRecord.payload.partyAAccountKey,
    partyBAccountKey: cashRecord.payload.partyBAccountKey,
    usdInstrumentKey,
  }
}

export interface MatureInputs {
  effectCids: string[]
  settlementFactoryCid: string
  routeProviderCid: string
  partyAHoldingCid: string | null
  partyBHoldingCid: string | null
  partyAAccountKey: AccountKey
  partyBAccountKey: AccountKey
  usdInstrumentKey: InstrumentKey
}

export async function resolveMatureInputs(
  client: LedgerClient,
  args: { workflowContractId: string; partyA: string; partyB: string },
): Promise<MatureInputs> {
  const [cashRecord] = await client.query<ContractResult<CashSetupRecord>>(
    'Setup.CashSetup:CashSetupRecord',
  )
  if (!cashRecord) throw new Error('Cash infrastructure not provisioned')

  const usdInstrumentKey = resolveDefaultCurrencyKey(cashRecord.payload)
  const usdId = usdInstrumentKey.id.unpack

  const effects = await client.query<ContractResult<Effect>>(EFFECT_TEMPLATE_ID)
  // An effect is "relevant" when its consumed or produced quantities include
  // USD — i.e., it represents a cashflow that needs settling. The target
  // instrument is the IRS (being evolved), not USD directly, so the old
  // `targetInstrument.id === usdId` filter never matched production effects.
  const touchesUsd = (q: Array<{ unit: { id: { unpack: string } } }> | undefined): boolean =>
    (q ?? []).some((x) => x.unit.id.unpack === usdId)
  // Effect payloads have two quantity lists. The on-ledger field names
  // are `otherProduced` / `otherConsumed` (the lifecycle-v4 schema);
  // the older names `producedQuantities` / `consumedQuantities` are kept
  // as fallbacks for any stale effect contracts.
  const produced = (e: ContractResult<Effect>) =>
    ((e.payload as unknown as { otherProduced?: unknown }).otherProduced as
      | Array<{ unit: { id: { unpack: string } } }>
      | undefined) ?? e.payload.producedQuantities
  const consumed = (e: ContractResult<Effect>) =>
    ((e.payload as unknown as { otherConsumed?: unknown }).otherConsumed as
      | Array<{ unit: { id: { unpack: string } } }>
      | undefined) ?? e.payload.consumedQuantities
  const relevant = effects.filter((e) => touchesUsd(produced(e)) || touchesUsd(consumed(e)))

  const holdings = await client.query<ContractResult<FungibleHolding>>(
    TRANSFERABLE_FUNGIBLE_TEMPLATE_ID,
  )
  const pickFor = (partyHint: string): string | null => {
    const usd = holdings.filter(
      (h) =>
        h.payload.instrument.id.unpack === usdId &&
        partyMatchesHint(h.payload.account.owner, partyHint),
    )
    if (usd.length === 0) return null
    return usd.reduce((a, b) =>
      parseFloat(a.payload.amount) >= parseFloat(b.payload.amount) ? a : b,
    ).contractId
  }

  const partyAHoldingCid = pickFor(args.partyA)
  const partyBHoldingCid = pickFor(args.partyB)

  // Only throw if effects exist but a party's holding is missing.
  if (relevant.length > 0) {
    if (!partyAHoldingCid) throw new Error(`No USD holding for ${args.partyA}`)
    if (!partyBHoldingCid) throw new Error(`No USD holding for ${args.partyB}`)
  }

  return {
    effectCids: relevant.map((e) => e.contractId),
    settlementFactoryCid: cashRecord.payload.settlementFactoryCid,
    routeProviderCid: cashRecord.payload.routeProviderCid,
    partyAHoldingCid,
    partyBHoldingCid,
    partyAAccountKey: cashRecord.payload.partyAAccountKey,
    partyBAccountKey: cashRecord.payload.partyBAccountKey,
    usdInstrumentKey,
  }
}

export interface TerminateInputs {
  settlementFactoryCid: string
  routeProviderCid: string
  proposerHoldingCid: string
  counterpartyHoldingCid: string
  proposerAccountKey: AccountKey
  counterpartyAccountKey: AccountKey
  usdInstrumentKey: InstrumentKey
}

export async function resolveTerminateInputs(
  client: LedgerClient,
  args: { proposer: string; counterparty: string },
): Promise<TerminateInputs> {
  const [cashRecord] = await client.query<ContractResult<CashSetupRecord>>(
    'Setup.CashSetup:CashSetupRecord',
  )
  if (!cashRecord) throw new Error('Cash infrastructure not provisioned')

  const usdInstrumentKey = resolveDefaultCurrencyKey(cashRecord.payload)
  const usdId = usdInstrumentKey.id.unpack

  const holdings = await client.query<ContractResult<FungibleHolding>>(
    TRANSFERABLE_FUNGIBLE_TEMPLATE_ID,
  )
  const pickFor = (partyHint: string): string => {
    const usd = holdings.filter(
      (h) =>
        h.payload.instrument.id.unpack === usdId &&
        partyMatchesHint(h.payload.account.owner, partyHint),
    )
    if (usd.length === 0) throw new Error(`No USD holding for ${partyHint}`)
    return usd.reduce((a, b) =>
      parseFloat(a.payload.amount) >= parseFloat(b.payload.amount) ? a : b,
    ).contractId
  }

  const proposerIsPartyA = cashRecord.payload.partyA === args.proposer
  const proposerAccountKey = proposerIsPartyA
    ? cashRecord.payload.partyAAccountKey
    : cashRecord.payload.partyBAccountKey
  const counterpartyAccountKey = proposerIsPartyA
    ? cashRecord.payload.partyBAccountKey
    : cashRecord.payload.partyAAccountKey

  return {
    settlementFactoryCid: cashRecord.payload.settlementFactoryCid,
    routeProviderCid: cashRecord.payload.routeProviderCid,
    proposerHoldingCid: pickFor(args.proposer),
    counterpartyHoldingCid: pickFor(args.counterparty),
    proposerAccountKey,
    counterpartyAccountKey,
    usdInstrumentKey,
  }
}
