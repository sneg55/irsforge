'use client'

import { useSyncExternalStore } from 'react'
import { deriveHealth, type LedgerHealthState, ledgerHealthBus } from '@/shared/ledger/health-bus'

// Subscribe to the ledger health bus and return a stable snapshot of the
// derived health state. `useSyncExternalStore` is the right primitive for
// a non-React mutable singleton — it tracks the latest snapshot via
// reference equality and re-renders the consumer only when the derived
// state actually changes.
export function useLedgerHealth(): LedgerHealthState {
  return useSyncExternalStore(
    (onChange) => ledgerHealthBus.subscribe(onChange),
    () => deriveHealth(ledgerHealthBus.getSnapshot()),
    // Server snapshot — match the client's "no calls observed" default
    // so SSR/hydration agree. The bus is client-only; on the server the
    // snapshot never advances past idle.
    () => 'idle',
  )
}
