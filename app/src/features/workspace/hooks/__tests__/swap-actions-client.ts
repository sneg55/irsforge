import { vi } from 'vitest'
import type { LedgerClient } from '@/shared/ledger/client'

export type FakeClient = Pick<LedgerClient, 'resolvePartyId' | 'create' | 'exercise'> & {
  resolvePartyId: ReturnType<typeof vi.fn>
  create: ReturnType<typeof vi.fn>
  exercise: ReturnType<typeof vi.fn>
  query: ReturnType<typeof vi.fn>
}

// Seeded FloatingRateIndex fixtures covering every index id the swap-action
// tests need. The BASIS accept resolves two indices (USD-SOFR + USD-EFFR);
// XCCY accept resolves the float-leg's index (EUR-ESTR). Per-test mocks can
// override via `.mockResolvedValueOnce(...)`.
export const FRI_FIXTURES = [
  { contractId: 'frid-usd-sofr', payload: { currency: 'USD', indexId: 'USD-SOFR' } },
  { contractId: 'frid-usd-effr', payload: { currency: 'USD', indexId: 'USD-EFFR' } },
  { contractId: 'frid-eur-estr', payload: { currency: 'EUR', indexId: 'EUR-ESTR' } },
]

export function fakeClient(): FakeClient {
  return {
    resolvePartyId: vi.fn((hint: string) => Promise.resolve(`${hint}::1220deadbeef`)),
    create: vi.fn(() => Promise.resolve({ contractId: 'cid-1' })),
    exercise: vi.fn(() => Promise.resolve(undefined)),
    query: vi.fn(() => Promise.resolve(FRI_FIXTURES)),
  }
}
