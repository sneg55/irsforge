import { render, renderHook } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { useAuth } from '../auth-context'
import { useConfig } from '../config-context'
import { LedgerProvider, useLedger } from '../ledger-context'

vi.mock('../auth-context', () => ({
  useAuth: vi.fn(),
}))
vi.mock('../config-context', () => ({
  useConfig: vi.fn(),
}))

describe('LedgerProvider', () => {
  test('provides null client when no token', () => {
    ;(useAuth as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      getToken: () => null,
      state: null,
    })
    ;(useConfig as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      getOrg: () => undefined,
    })

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LedgerProvider>{children}</LedgerProvider>
    )
    const { result } = renderHook(() => useLedger(), { wrapper })
    expect(result.current.client).toBeNull()
    expect(result.current.activeParty).toBeNull()
    expect(result.current.partyDisplayName).toBe('')
    expect(result.current.activeOrg).toBeNull()
  })

  test('provides client and context values when token+state present', () => {
    ;(useAuth as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      getToken: () => 'jwt-token',
      state: { orgId: 'goldman', party: 'PartyA', userId: 'user1' },
    })
    ;(useConfig as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      getOrg: (id: string) => ({
        id,
        party: 'PartyA',
        displayName: 'Goldman',
        hint: 'PA',
        ledgerUrl: 'http://x',
      }),
    })

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LedgerProvider>{children}</LedgerProvider>
    )
    const { result } = renderHook(() => useLedger(), { wrapper })
    expect(result.current.client).not.toBeNull()
    expect(result.current.activeParty).toBe('PartyA')
    expect(result.current.partyDisplayName).toBe('user1')
    expect(result.current.activeOrg?.id).toBe('goldman')
  })

  test('default context returns null client out of provider', () => {
    const { result } = renderHook(() => useLedger())
    expect(result.current.client).toBeNull()
    // Render smoke — default provider value path.
    render(<div />)
  })
})
