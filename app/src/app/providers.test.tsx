import { type QueryClient, useQueryClient } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { Providers } from './providers'

// Capture props passed to PartyDirectoryProvider so we can assert the token
// wiring. The bug: PartyDirectoryBridge read the token via useLedgerClient(),
// but LedgerProvider is only mounted inside org-shell layouts — so the bridge
// sat above LedgerProvider and always got token=undefined. The fix reads the
// token from useAuth() directly; this test pins that wiring.
const partyProviderCalls: Record<string, unknown>[] = []

vi.mock('canton-party-directory/react', () => ({
  PartyDirectoryProvider: (props: Record<string, unknown> & { children: ReactNode }) => {
    partyProviderCalls.push(props)
    return <>{props.children}</>
  },
}))

vi.mock('@/shared/contexts/config-context', () => ({
  ConfigProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useConfig: () => ({
    config: {
      orgs: [
        { id: 'orgA', hint: 'hintA', displayName: 'Org A' },
        { id: 'orgB', hint: 'hintB', displayName: 'Org B' },
      ],
    },
  }),
}))

let mockToken: string | null = null
vi.mock('@/shared/contexts/auth-context', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useAuth: () => ({ getToken: () => mockToken }),
}))

describe('PartyDirectoryBridge wiring', () => {
  it('passes the auth token through to PartyDirectoryProvider', () => {
    partyProviderCalls.length = 0
    mockToken = 'test-bearer-token'

    render(
      <Providers>
        <div>child</div>
      </Providers>,
    )

    expect(partyProviderCalls.length).toBeGreaterThan(0)
    const props = partyProviderCalls[partyProviderCalls.length - 1]
    expect(props.token).toBe('test-bearer-token')
    expect(props.proxyUrl).toBe('/api/ledger')
    expect(props.entries).toEqual([
      { identifier: '', displayName: 'Org A', hint: 'hintA' },
      { identifier: '', displayName: 'Org B', hint: 'hintB' },
    ])
  })

  it('passes undefined (not null) when no token is available', () => {
    partyProviderCalls.length = 0
    mockToken = null

    render(
      <Providers>
        <div>child</div>
      </Providers>,
    )

    const props = partyProviderCalls[partyProviderCalls.length - 1]
    expect(props.token).toBeUndefined()
  })
})

function QueryClientProbe({ onReady }: { onReady: (c: QueryClient) => void }) {
  const qc = useQueryClient()
  onReady(qc)
  return <span>probe</span>
}

describe('Providers — QueryClient defaults', () => {
  it('sets retry = 3 with exponential backoff, keepPreviousData placeholder, mutations.retry = 0', () => {
    mockToken = null
    let captured: QueryClient | null = null
    render(
      <Providers>
        <QueryClientProbe
          onReady={(c) => {
            captured = c
          }}
        />
      </Providers>,
    )
    expect(screen.getByText('probe')).toBeTruthy()
    expect(captured).not.toBeNull()
    const defaults = captured!.getDefaultOptions()
    expect(defaults.queries?.retry).toBe(3)
    // retryDelay is now a function (exponential backoff capped at 30s);
    // verify the curve at attempt 0/3/6 instead of asserting the literal.
    const retryDelayFn = defaults.queries?.retryDelay as (attempt: number) => number
    expect(typeof retryDelayFn).toBe('function')
    expect(retryDelayFn(0)).toBe(1_000)
    expect(retryDelayFn(3)).toBe(8_000)
    expect(retryDelayFn(6)).toBe(30_000)
    expect(defaults.queries?.staleTime).toBe(30_000)
    expect(defaults.queries?.placeholderData).toBeDefined()
    expect(defaults.mutations?.retry).toBe(0)
  })
})
