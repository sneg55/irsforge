'use client'

import { keepPreviousData, QueryClient, QueryClientProvider } from '@tanstack/react-query'
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

  // Wrap the entire app in a flex column that owns the 100 dvh viewport
  // budget so the sticky DemoResetBanner can take its natural ~29 px out of
  // that budget instead of stacking on top of the shell layout's `h-screen`.
  // Without this, banner (sticky, in flow) + shell (h-screen = 100 vh) sums
  // to viewport + ~29 px — the StatusBar at the bottom of the shell ends up
  // ~29 px below the fold and users have to scroll to see it.
  //
  // The inner div keeps flex-col so child layouts (auth pages, party
  // selector, shell) can use `flex-1` / `h-full` to inherit the available
  // height instead of asserting `h-screen` themselves.
  return (
    <PartyDirectoryProvider
      entries={entries}
      proxyUrl="/api/ledger"
      token={getToken() ?? undefined}
    >
      <div className="flex h-screen flex-col">
        <DemoResetBanner />
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
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
          //
          // placeholderData: keepPreviousData stops the table from blanking
          // on every refetch. Without it, each 3s poll re-rendered with
          // `data: undefined` for one frame before resolving — visible to
          // the user as the swap rows "jumping" while ledger is healthy.
          //
          // retryDelay uses exponential backoff capped at 30s. With the
          // earlier flat 500 ms, a Canton-down window meant every refetch
          // burned through retries in <2s, surfaced as error, then the 3s
          // refetchInterval immediately fired the next attempt — effectively
          // pinning ~2 attempts per second across all blotter queries while
          // the ledger was unreachable. Backoff lets failed queries cool off.
          queries: {
            retry: 3,
            retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
            staleTime: 30_000,
            placeholderData: keepPreviousData,
          },
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
