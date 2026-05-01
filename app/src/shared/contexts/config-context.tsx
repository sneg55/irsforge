'use client'

import { createContext, type ReactNode, useContext, useEffect, useState } from 'react'
import { type ClientConfig, loadClientConfig, type OrgConfig } from '../config/client'

interface ConfigContextValue {
  config: ClientConfig | null
  loading: boolean
  getOrg: (orgId: string) => OrgConfig | undefined
}

const ConfigContext = createContext<ConfigContextValue>({
  config: null,
  loading: true,
  getOrg: () => undefined,
})

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ClientConfig | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadClientConfig()
      .then(setConfig)
      .catch((err) => {
        console.error('Failed to load client config:', err)
      })
      .finally(() => setLoading(false))
  }, [])

  function getOrg(orgId: string): OrgConfig | undefined {
    return config?.orgs.find((o) => o.id === orgId)
  }

  return (
    <ConfigContext.Provider value={{ config, loading, getOrg }}>{children}</ConfigContext.Provider>
  )
}

export function useConfig(): ConfigContextValue {
  return useContext(ConfigContext)
}
