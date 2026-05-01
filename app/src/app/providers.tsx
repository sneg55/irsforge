'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PartyDirectoryProvider } from 'canton-party-directory/react'
import { type ReactNode, useState } from 'react'
import { AuthProvider, useAuth } from '@/shared/contexts/auth-context'
import { ConfigProvider, useConfig } from '@/shared/contexts/config-context'
import { DemoResetBanner } from '@/shared/layout/demo-reset-banner'

function PartyDirectoryBridge({ children }: { children: ReactNode }) {
  const { config } = useConfig()
  const { getToken } = useAuth()

  const entries =
    config?.orgs.map((o) => ({
      identifier: '',
      displayName: o.displayName,
      hint: o.hint,
    })) ?? []

  return (
    <PartyDirectoryProvider
      entries={entries}
      proxyUrl="/api/ledger"
      token={getToken() ?? undefined}
    >
      <DemoResetBanner />
      {children}
    </PartyDirectoryProvider>
  )
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          // staleTime stops every useQuery from refiring on each page remount.
          // Queries that need faster freshness override via refetchInterval
          // (blotter workflows poll at 3s regardless).
          queries: { retry: 1, retryDelay: 500, staleTime: 30_000 },
          mutations: { retry: 0 },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider>
        <AuthProvider>
          <PartyDirectoryBridge>{children}</PartyDirectoryBridge>
        </AuthProvider>
      </ConfigProvider>
    </QueryClientProvider>
  )
}
