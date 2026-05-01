/**
 * Shared fixtures for use-active-contracts tests.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { vi } from 'vitest'

/** Minimal slim SwapWorkflow payload — instrumentKey required by the slim type. */
export function wfPayload(overrides: Record<string, unknown> = {}) {
  return {
    swapType: 'IRS',
    operator: 'Operator::ns',
    partyA: 'Alice::ns',
    partyB: 'Bob::ns',
    regulators: ['Regulator::ns'],
    instrumentKey: {
      depository: 'Dep',
      issuer: 'Op',
      id: { unpack: 'IRS-1' },
      version: '0',
      holdingStandard: 'TransferableFungible',
    },
    notional: '1000000',
    ...overrides,
  }
}

export type FakeClient = { query: ReturnType<typeof vi.fn> }

export function fakeClient(overrides: Partial<Record<string, unknown[]>> = {}): FakeClient {
  return {
    query: vi.fn((tpl: string) => Promise.resolve(overrides[tpl] ?? [])),
  }
}

/** Wrap hook in QueryClientProvider so useSwapInstruments can call useQueries. */
export function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children)
}
