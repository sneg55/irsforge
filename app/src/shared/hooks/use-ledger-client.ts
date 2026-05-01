'use client'

import { useLedger } from '../contexts/ledger-context'
import type { LedgerClient } from '../ledger/client'

interface LedgerClientResult {
  client: LedgerClient | null
  activeParty: string | null
  partyDisplayName: string
}

export function useLedgerClient(): LedgerClientResult {
  const ledger = useLedger()
  return {
    client: ledger.client,
    activeParty: ledger.activeParty,
    partyDisplayName: ledger.partyDisplayName,
  }
}
