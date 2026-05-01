// Reusable mock builders for replay.unit.test.ts and
// replay-resolve-swap.unit.test.ts. Kept tiny on purpose — every helper
// returns the on-chain row shape the replay code consumes via
// LedgerClient.query, so individual tests can override only the fields
// they care about.

import type { LedgerClient } from '../../../../shared/ledger-client.js'

type QueryReturn = Array<{ contractId: string; payload: unknown }>

export function fakeClient(by: Record<string, QueryReturn>): LedgerClient {
  return {
    query: async (templateId: string) => by[templateId] ?? [],
  } as unknown as LedgerClient
}

export function curveRow(
  contractId: string,
  overrides: Partial<{
    currency: string
    curveType: 'Discount' | 'Projection'
    indexId: string | null
    asOf: string
  }> = {},
) {
  return {
    contractId,
    payload: {
      currency: overrides.currency ?? 'USD',
      curveType: overrides.curveType ?? 'Discount',
      indexId: overrides.indexId ?? null,
      asOf: overrides.asOf ?? '2026-04-17T00:00:00Z',
      pillars: [{ tenorDays: '365', zeroRate: '0.04' }],
      interpolation: 'LinearZero',
      dayCount: 'Act360',
    },
  }
}

export function indexRow(
  contractId: string,
  overrides: Partial<{ indexId: string; currency: string; family: string }> = {},
) {
  return {
    contractId,
    payload: {
      indexId: overrides.indexId ?? 'USD-SOFR',
      currency: overrides.currency ?? 'USD',
      family: overrides.family ?? 'SOFR',
      compounding: 'CompoundedInArrears',
      lookback: '0',
      floor: null,
    },
  }
}

export function obsRow(contractId: string, indexId: string, observations: [string, string][]) {
  return {
    contractId,
    payload: {
      id: { unpack: indexId },
      observations,
    },
  }
}

export const baseWfPayload = {
  operator: 'Op',
  partyA: 'PA',
  partyB: 'PB',
  regulators: ['Reg'],
  scheduler: 'Sch',
  instrumentKey: {
    depository: 'D',
    issuer: 'I',
    id: { unpack: 'instr-x' },
    version: '1',
    holdingStandard: 'TransferableFungible',
  },
  notional: '1000000',
}
