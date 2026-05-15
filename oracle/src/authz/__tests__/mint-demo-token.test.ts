import type { Config } from 'irsforge-shared-config'
import * as jose from 'jose'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mintDemoOperatorToken } from '../mint-demo-token.js'

// Minimal Config that mintDemoOperatorToken touches. Only the auth +
// daml branches are read; the rest can be cast-loose since the function
// never reaches into them.
function demoConfig(overrides: Partial<Config['daml']> = {}): Config {
  return {
    auth: { provider: 'demo' },
    daml: {
      ledgerId: 'sandbox',
      applicationId: 'irsforge-oracle',
      unsafeJwtSecret: 'test-secret-min-32-bytes-long-pls!!',
      ...overrides,
    },
  } as unknown as Config
}

async function decodeClaims(token: string): Promise<{
  ledgerId: string
  applicationId: string
  actAs: string[]
  readAs: string[]
}> {
  const secret = new TextEncoder().encode('test-secret-min-32-bytes-long-pls!!')
  const { payload } = await jose.jwtVerify(token, secret)
  return (payload as Record<string, unknown>)['https://daml.com/ledger-api'] as {
    ledgerId: string
    applicationId: string
    actAs: string[]
    readAs: string[]
  }
}

describe('mintDemoOperatorToken', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns null when auth provider is not demo', async () => {
    const cfg = demoConfig()
    cfg.auth = { provider: 'builtin' } as Config['auth']
    expect(await mintDemoOperatorToken(cfg)).toBeNull()
  })

  it('returns null when unsafeJwtSecret is missing', async () => {
    const cfg = demoConfig()
    // biome-ignore lint/suspicious/noExplicitAny: forcing the missing-secret edge case
    ;(cfg.daml as any).unsafeJwtSecret = undefined
    expect(await mintDemoOperatorToken(cfg)).toBeNull()
  })

  it('returns null when /v1/parties responds non-2xx', async () => {
    vi.stubGlobal('fetch', async () => new Response('forbidden', { status: 403 }))
    expect(await mintDemoOperatorToken(demoConfig())).toBeNull()
  })

  it('returns null when /v1/parties throws (sandbox not up)', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('ECONNREFUSED')
    })
    expect(await mintDemoOperatorToken(demoConfig())).toBeNull()
  })

  it('returns null when no party named Operator is allocated', async () => {
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(
          JSON.stringify({
            result: [
              { identifier: 'Goldman::1220abcd', displayName: 'Goldman Sachs', isLocal: true },
              { identifier: 'JPM::1220ef01', displayName: 'JPMorgan', isLocal: true },
            ],
          }),
          { status: 200 },
        ),
    )
    expect(await mintDemoOperatorToken(demoConfig())).toBeNull()
  })

  it('mints a token with the qualified Operator id and all parties as readAs', async () => {
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(
          JSON.stringify({
            result: [
              { identifier: 'Operator::1220deadbeef', displayName: 'Operator', isLocal: true },
              { identifier: 'Goldman::1220abcd', displayName: 'Goldman Sachs', isLocal: true },
              { identifier: 'JPM::1220ef01', displayName: 'JPMorgan', isLocal: true },
            ],
          }),
          { status: 200 },
        ),
    )
    const token = await mintDemoOperatorToken(demoConfig())
    expect(token).not.toBeNull()
    const claims = await decodeClaims(token!)
    expect(claims.ledgerId).toBe('sandbox')
    expect(claims.applicationId).toBe('irsforge-oracle')
    expect(claims.actAs).toEqual(['Operator::1220deadbeef'])
    expect(claims.readAs).toEqual(['Operator::1220deadbeef', 'Goldman::1220abcd', 'JPM::1220ef01'])
  })

  it('matches by short-name even when displayName is something else', async () => {
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(
          JSON.stringify({
            result: [
              {
                identifier: 'Operator::1220deadbeef',
                // displayName diverges; short-name still matches.
                displayName: 'IRSForge Operator',
                isLocal: true,
              },
            ],
          }),
          { status: 200 },
        ),
    )
    const token = await mintDemoOperatorToken(demoConfig())
    expect(token).not.toBeNull()
    const claims = await decodeClaims(token!)
    expect(claims.actAs).toEqual(['Operator::1220deadbeef'])
  })

  it('matches by displayName even when short-name diverges', async () => {
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(
          JSON.stringify({
            result: [
              {
                // Short-name "Op" misses; displayName "Operator" matches.
                identifier: 'Op::1220deadbeef',
                displayName: 'Operator',
                isLocal: true,
              },
            ],
          }),
          { status: 200 },
        ),
    )
    const token = await mintDemoOperatorToken(demoConfig())
    expect(token).not.toBeNull()
    const claims = await decodeClaims(token!)
    expect(claims.actAs).toEqual(['Op::1220deadbeef'])
  })

  it('signs with HS256 (verifies cleanly with the unsafeJwtSecret)', async () => {
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(
          JSON.stringify({
            result: [
              { identifier: 'Operator::1220deadbeef', displayName: 'Operator', isLocal: true },
            ],
          }),
          { status: 200 },
        ),
    )
    const token = await mintDemoOperatorToken(demoConfig())
    const header = jose.decodeProtectedHeader(token!)
    expect(header.alg).toBe('HS256')
  })
})
