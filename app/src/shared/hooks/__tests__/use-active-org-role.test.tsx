import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useActiveOrgRole } from '../use-active-org-role'

const mockUseLedger = vi.fn()
const mockUseConfig = vi.fn()

vi.mock('@/shared/contexts/ledger-context', () => ({
  useLedger: () => mockUseLedger(),
}))

vi.mock('@/shared/contexts/config-context', () => ({
  useConfig: () => mockUseConfig(),
}))

// Org fixtures carry both `hint` (demo path) and `party` (full Canton id —
// production builtin/OIDC path) so the lookup is exercised against both
// shapes the hook must support.
const ORGS = [
  { id: 'goldman', party: 'PartyA::abc', hint: 'PartyA', role: 'trader' },
  { id: 'jpmorgan', party: 'PartyB::abc', hint: 'PartyB', role: 'trader' },
  { id: 'operator', party: 'Operator::abc', hint: 'Operator', role: 'operator' },
  { id: 'regulator', party: 'Regulator::abc', hint: 'Regulator', role: 'regulator' },
]

describe('useActiveOrgRole', () => {
  // Default: no activeOrg in LedgerContext (forces the config-fallback path)
  // and `profile: demo` so the hint-scan branch is unlocked.
  function arrange(
    activeParty: string | null,
    activeOrg: unknown = null,
    profile: 'demo' | 'production' = 'demo',
  ) {
    mockUseLedger.mockReturnValue({ activeParty, activeOrg })
    mockUseConfig.mockReturnValue({ config: { orgs: ORGS, profile } })
  }

  it("returns 'trader' for a trader party hint", () => {
    arrange('PartyA')
    const { result } = renderHook(() => useActiveOrgRole())
    expect(result.current).toBe('trader')
  })

  it("returns 'operator' for the operator hint", () => {
    arrange('Operator')
    const { result } = renderHook(() => useActiveOrgRole())
    expect(result.current).toBe('operator')
  })

  it("returns 'regulator' for the regulator hint", () => {
    arrange('Regulator')
    const { result } = renderHook(() => useActiveOrgRole())
    expect(result.current).toBe('regulator')
  })

  it("returns 'trader' (safe default) when activeParty is null", () => {
    arrange(null)
    const { result } = renderHook(() => useActiveOrgRole())
    expect(result.current).toBe('trader')
  })

  it("returns 'trader' (safe default) when activeParty matches no org", () => {
    arrange('UnknownParty')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { result } = renderHook(() => useActiveOrgRole())
    expect(result.current).toBe('trader')
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('useActiveOrgRole: no org matches activeParty'),
    )
    warn.mockRestore()
  })

  it('matches a full Canton id (production builtin/OIDC path)', () => {
    arrange('Operator::xyz')
    const { result } = renderHook(() => useActiveOrgRole())
    expect(result.current).toBe('operator')
  })

  it('prefers activeOrg.role when LedgerProvider has resolved it', () => {
    arrange('PartyA', { role: 'regulator' })
    const { result } = renderHook(() => useActiveOrgRole())
    expect(result.current).toBe('regulator')
  })

  // Under profile=production, the demo hint-scan is disabled — even when the
  // active party would have matched an org by hint. The hook returns the
  // safe 'trader' default and logs an error so the misconfiguration is loud.
  it('does NOT hint-scan under profile=production, even on a hint that would match', () => {
    arrange('Regulator', null, 'production')
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result } = renderHook(() => useActiveOrgRole())
    expect(result.current).toBe('trader')
    expect(err).toHaveBeenCalledWith(expect.stringContaining("profile='production'"))
    err.mockRestore()
  })

  // Production path still trusts activeOrg.role when LedgerProvider populates
  // it — the gating only affects the fallback branch.
  it('still respects activeOrg.role under profile=production', () => {
    arrange('Operator::xyz', { role: 'regulator' }, 'production')
    const { result } = renderHook(() => useActiveOrgRole())
    expect(result.current).toBe('regulator')
  })
})
