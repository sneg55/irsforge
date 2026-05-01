import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import { PartyDirectory } from './core'
import type { DirectoryConfig, PartyEntry } from './types'

interface PartyDirectoryContextValue {
  directory: PartyDirectory
  displayName: (identifier: string) => string
  loading: boolean
}

const PartyDirectoryContext = createContext<PartyDirectoryContextValue | null>(null)

interface ProviderProps {
  entries?: PartyEntry[]
  ledgerUrl?: string
  proxyUrl?: string
  token?: string | (() => string | Promise<string>)
  children: ReactNode
}

export function PartyDirectoryProvider({
  entries,
  ledgerUrl,
  proxyUrl,
  token,
  children,
}: ProviderProps) {
  const directory = useMemo(() => {
    return new PartyDirectory({ entries, ledgerUrl, proxyUrl, token })
  }, [])

  const [loading, setLoading] = useState(!!(ledgerUrl || proxyUrl))
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (entries?.length) {
      directory.register(entries)
      setVersion((v) => v + 1)
    }
  }, [entries, directory])

  useEffect(() => {
    if (!ledgerUrl && !proxyUrl) return
    directory
      .sync(typeof token === 'string' ? token : undefined)
      .then(() => {
        setLoading(false)
        setVersion((v) => v + 1)
      })
      .catch((err) => {
        console.error('[canton-party-directory] sync failed', err)
        setLoading(false)
      })
  }, [directory, ledgerUrl, proxyUrl, token])

  const value = useMemo(
    () => ({
      directory,
      displayName: (id: string) => directory.displayName(id),
      loading,
    }),

    [directory, loading, version],
  )

  return <PartyDirectoryContext.Provider value={value}>{children}</PartyDirectoryContext.Provider>
}

export function usePartyDirectory(): PartyDirectoryContextValue {
  const ctx = useContext(PartyDirectoryContext)
  if (!ctx) {
    throw new Error('usePartyDirectory must be used within a <PartyDirectoryProvider>')
  }
  return ctx
}
