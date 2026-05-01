'use client'

import { createContext, type ReactNode, useContext, useMemo } from 'react'
import type { OrgConfig } from '../config/client'
import { LedgerClient } from '../ledger/client'
import { useAuth } from './auth-context'
import { useConfig } from './config-context'

interface LedgerContextValue {
  client: LedgerClient | null
  activeParty: string | null
  partyDisplayName: string
  activeOrg: OrgConfig | null
}

const LedgerContext = createContext<LedgerContextValue>({
  client: null,
  activeParty: null,
  partyDisplayName: '',
  activeOrg: null,
})

interface LedgerProviderProps {
  children: ReactNode
}

export function LedgerProvider({ children }: LedgerProviderProps) {
  const { getToken, state } = useAuth()
  const { getOrg } = useConfig()

  const token = getToken()
  const orgId = state?.orgId ?? null

  const client = useMemo(() => {
    if (!token) return null
    return new LedgerClient(token, orgId ?? undefined)
  }, [token, orgId])

  const activeOrg = orgId ? (getOrg(orgId) ?? null) : null
  const activeParty = state?.party ?? null
  const partyDisplayName = state?.userId ?? ''

  return (
    <LedgerContext.Provider value={{ client, activeParty, partyDisplayName, activeOrg }}>
      {children}
    </LedgerContext.Provider>
  )
}

export function useLedger(): LedgerContextValue {
  return useContext(LedgerContext)
}
