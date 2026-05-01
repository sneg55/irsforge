import type { LedgerActivityEvent } from '@/features/ledger/types'

/**
 * Minimal LedgerActivityEvent factory for `decode()` tests. Defaults to a
 * `'create'` event with placeholder template/contract/timestamp; tests
 * override only the fields that drive the branch under test.
 */
export function ev(partial: Partial<LedgerActivityEvent>): LedgerActivityEvent {
  return {
    kind: 'create',
    templateId: 'unknown:Module:Type',
    contractId: 'cid',
    party: null,
    ts: 1700000000,
    ...partial,
  }
}
