import { describe, expect, it } from 'vitest'
import { type ClientConfig, resolveAuthUrl, resolveStreamUrl } from './client'

const BASE: ClientConfig = {
  topology: 'sandbox',
  routing: 'path',
  auth: { provider: 'demo' },
  daml: { ledgerId: 'sandbox', applicationId: 'IRSForge', unsafeJwtSecret: 'secret' },
  orgs: [
    {
      id: 'a',
      party: 'A',
      displayName: 'A',
      hint: 'A',
      role: 'trader',
      ledgerUrl: 'http://localhost:7575',
    },
  ],
}

describe('resolveAuthUrl', () => {
  it('returns authBaseUrl for builtin, ignoring the JWT issuer', () => {
    // issuer is a JWT `iss` claim, not an HTTP endpoint — SPA must still
    // call the auth service at authBaseUrl.
    const config: ClientConfig = {
      ...BASE,
      authBaseUrl: 'http://auth:3002',
      auth: { provider: 'builtin', builtin: { issuer: 'https://issuer.example/' } },
    }
    expect(resolveAuthUrl(config)).toBe('http://auth:3002')
  })

  it('returns authBaseUrl for oidc, ignoring the external IdP authority', () => {
    // `oidc.authority` is the external OpenID Provider (e.g. Azure AD),
    // which does NOT expose /auth/authorize or /auth/handoff.
    const config: ClientConfig = {
      ...BASE,
      authBaseUrl: 'http://auth:3002',
      auth: {
        provider: 'oidc',
        oidc: { authority: 'https://login.microsoftonline.com/tenant/v2.0', clientId: 'x' },
      },
    }
    expect(resolveAuthUrl(config)).toBe('http://auth:3002')
  })

  it('throws for demo provider', () => {
    expect(() => resolveAuthUrl(BASE)).toThrow(/demo/)
  })

  it('throws when authBaseUrl is missing for non-demo providers', () => {
    const config: ClientConfig = {
      ...BASE,
      auth: { provider: 'builtin', builtin: { issuer: 'http://auth:3002' } },
    }
    expect(() => resolveAuthUrl(config)).toThrow(/authBaseUrl/)
  })
})

describe('resolveStreamUrl', () => {
  const base = {
    id: 'goldman',
    party: 'PartyA',
    displayName: 'Goldman',
    hint: 'PartyA',
    role: 'trader' as const,
    ledgerUrl: 'http://localhost:7575',
  }
  it('returns streamUrl verbatim when set', () => {
    expect(resolveStreamUrl({ ...base, streamUrl: 'wss://stream.example.com' })).toBe(
      'wss://stream.example.com',
    )
  })
  it('derives ws:// from http:// ledgerUrl', () => {
    expect(resolveStreamUrl(base)).toBe('ws://localhost:7575')
  })
  it('derives wss:// from https:// ledgerUrl', () => {
    expect(resolveStreamUrl({ ...base, ledgerUrl: 'https://ledger.example.com' })).toBe(
      'wss://ledger.example.com',
    )
  })
  it('throws for non-HTTP(S) ledgerUrl without explicit streamUrl', () => {
    expect(() => resolveStreamUrl({ ...base, ledgerUrl: 'ftp://bad' })).toThrow(/streamUrl/)
  })
})
