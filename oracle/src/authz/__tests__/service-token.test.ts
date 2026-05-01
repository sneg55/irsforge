import type { Config } from 'irsforge-shared-config'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as demoSch from '../mint-demo-scheduler-token.js'
import * as demoOp from '../mint-demo-token.js'
import { resolveServiceToken } from '../service-token.js'

const BASE_CONFIG = {
  auth: { provider: 'demo', serviceAccounts: [] },
  daml: { ledgerId: 'sandbox', applicationId: 'IRSForge', unsafeJwtSecret: 'secret' },
  platform: { authPublicUrl: 'http://localhost:3002' },
} as unknown as Config

const BUILTIN_CONFIG = {
  auth: { provider: 'builtin', serviceAccounts: [{ id: 'scheduler', actAs: ['Scheduler'] }] },
  daml: { ledgerId: 'sandbox', applicationId: 'IRSForge', unsafeJwtSecret: '' },
  platform: { authPublicUrl: 'http://localhost:3002' },
} as unknown as Config

function oauthResponse(token: string, expiresIn: number): Response {
  return new Response(
    JSON.stringify({ access_token: token, token_type: 'Bearer', expires_in: expiresIn }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}

function clearTokenEnv(): void {
  delete process.env.SERVICE_TOKEN_SCHEDULER
  delete process.env.SERVICE_TOKEN_MARK_PUBLISHER
  delete process.env.OPERATOR_TOKEN
  delete process.env.SERVICE_CLIENT_SECRET_SCHEDULER
  delete process.env.SERVICE_CLIENT_SECRET_MARK_PUBLISHER
}

describe('resolveServiceToken — env override branch', () => {
  beforeEach(() => {
    clearTokenEnv()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    clearTokenEnv()
  })

  it('uses SERVICE_TOKEN_SCHEDULER verbatim when set', async () => {
    process.env.SERVICE_TOKEN_SCHEDULER = 'explicit-scheduler-jwt'
    const handle = await resolveServiceToken('scheduler', BASE_CONFIG)
    expect(await handle.getToken()).toBe('explicit-scheduler-jwt')
    handle.stop()
  })

  it('hyphenated accountId maps to underscore env var', async () => {
    process.env.SERVICE_TOKEN_MARK_PUBLISHER = 'explicit-mark-jwt'
    const handle = await resolveServiceToken('mark-publisher', BASE_CONFIG)
    expect(await handle.getToken()).toBe('explicit-mark-jwt')
  })

  it('OPERATOR_TOKEN is the legacy alias for mark-publisher', async () => {
    process.env.OPERATOR_TOKEN = 'legacy-operator-jwt'
    const handle = await resolveServiceToken('mark-publisher', BASE_CONFIG)
    expect(await handle.getToken()).toBe('legacy-operator-jwt')
  })

  it('SERVICE_TOKEN_MARK_PUBLISHER wins over OPERATOR_TOKEN when both set', async () => {
    process.env.OPERATOR_TOKEN = 'legacy'
    process.env.SERVICE_TOKEN_MARK_PUBLISHER = 'new'
    const handle = await resolveServiceToken('mark-publisher', BASE_CONFIG)
    expect(await handle.getToken()).toBe('new')
  })

  it('OPERATOR_TOKEN does NOT short-circuit scheduler', async () => {
    process.env.OPERATOR_TOKEN = 'legacy-operator-jwt'
    // scheduler falls through to demo branch; demo mint fails (no Canton),
    // but the resolver must not mistakenly hand back the legacy operator token.
    const mintSpy = vi.spyOn(demoSch, 'mintDemoSchedulerToken').mockResolvedValue('demo-mint-jwt')
    const handle = await resolveServiceToken('scheduler', BASE_CONFIG)
    expect(await handle.getToken()).toBe('demo-mint-jwt')
    expect(mintSpy).toHaveBeenCalledTimes(1)
  })
})

describe('resolveServiceToken — demo branch', () => {
  beforeEach(() => {
    clearTokenEnv()
    vi.restoreAllMocks()
  })

  it('dispatches mark-publisher to mintDemoOperatorToken', async () => {
    const spy = vi.spyOn(demoOp, 'mintDemoOperatorToken').mockResolvedValue('minted-op-jwt')
    const handle = await resolveServiceToken('mark-publisher', BASE_CONFIG)
    expect(await handle.getToken()).toBe('minted-op-jwt')
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('dispatches scheduler to mintDemoSchedulerToken', async () => {
    const spy = vi.spyOn(demoSch, 'mintDemoSchedulerToken').mockResolvedValue('minted-sch-jwt')
    const handle = await resolveServiceToken('scheduler', BASE_CONFIG)
    expect(await handle.getToken()).toBe('minted-sch-jwt')
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('throws when demo mint returns null', async () => {
    vi.spyOn(demoSch, 'mintDemoSchedulerToken').mockResolvedValue(null)
    await expect(resolveServiceToken('scheduler', BASE_CONFIG)).rejects.toThrow(/demo mint/i)
  })
})

describe('resolveServiceToken — OAuth2 service-account branch', () => {
  beforeEach(() => {
    clearTokenEnv()
    vi.restoreAllMocks()
    process.env.SERVICE_CLIENT_SECRET_SCHEDULER = 'top-secret'
  })

  afterEach(() => {
    clearTokenEnv()
    vi.useRealTimers()
  })

  it('POSTs client-credentials and returns a handle over the access token', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => Promise.resolve(oauthResponse('jwt-1', 900)))
    const handle = await resolveServiceToken('scheduler', BUILTIN_CONFIG)
    expect(await handle.getToken()).toBe('jwt-1')
    const call = fetchSpy.mock.calls[0]
    expect(call[0]).toBe('http://localhost:3002/auth/oauth/token')
    const opts = call[1] as RequestInit
    expect(opts.method).toBe('POST')
    const h = opts.headers as Record<string, string>
    expect(h['Content-Type']).toBe('application/x-www-form-urlencoded')
    const params = new URLSearchParams(opts.body as string)
    expect(params.get('grant_type')).toBe('client_credentials')
    expect(params.get('client_id')).toBe('scheduler')
    expect(params.get('client_secret')).toBe('top-secret')
    handle.stop()
  })

  it('proactively refreshes at expires_in × 0.8 and swaps the stored token', async () => {
    vi.useFakeTimers()
    vi.spyOn(globalThis, 'fetch')
      .mockImplementationOnce(() => Promise.resolve(oauthResponse('first-jwt', 900)))
      .mockImplementationOnce(() => Promise.resolve(oauthResponse('second-jwt', 900)))

    const handle = await resolveServiceToken('scheduler', BUILTIN_CONFIG)
    expect(await handle.getToken()).toBe('first-jwt')

    await vi.advanceTimersByTimeAsync(900 * 0.8 * 1000 + 10)
    expect(await handle.getToken()).toBe('second-jwt')
    handle.stop()
  })

  it('fatals at startup when SERVICE_CLIENT_SECRET_* env is missing', async () => {
    delete process.env.SERVICE_CLIENT_SECRET_SCHEDULER
    await expect(resolveServiceToken('scheduler', BUILTIN_CONFIG)).rejects.toThrow(
      /SERVICE_CLIENT_SECRET/,
    )
  })

  it('fatals at startup on HTTP 401 (invalid_client)', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ error: 'invalid_client' }), { status: 401 })),
    )
    await expect(resolveServiceToken('scheduler', BUILTIN_CONFIG)).rejects.toThrow(
      /401|invalid_client/,
    )
  })

  it('refresh failure keeps the old token until the extra retry succeeds', async () => {
    vi.useFakeTimers()
    vi.spyOn(globalThis, 'fetch')
      .mockImplementationOnce(() => Promise.resolve(oauthResponse('first-jwt', 900)))
      .mockImplementationOnce(() => Promise.reject(new Error('network down')))
      .mockImplementationOnce(() => Promise.resolve(oauthResponse('third-jwt', 900)))

    const handle = await resolveServiceToken('scheduler', BUILTIN_CONFIG)
    expect(await handle.getToken()).toBe('first-jwt')

    // First refresh at 0.8 × TTL fails.
    await vi.advanceTimersByTimeAsync(900 * 0.8 * 1000 + 10)
    expect(await handle.getToken()).toBe('first-jwt')

    // Retry scheduled 0.125 × 0.8 × TTL later = 0.1 × TTL later. Succeeds.
    await vi.advanceTimersByTimeAsync(900 * 0.1 * 1000 + 10)
    expect(await handle.getToken()).toBe('third-jwt')
    handle.stop()
  })

  it('stop() clears the refresh timer', async () => {
    vi.useFakeTimers()
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => Promise.resolve(oauthResponse('jwt-1', 900)))
    const handle = await resolveServiceToken('scheduler', BUILTIN_CONFIG)
    handle.stop()
    await vi.advanceTimersByTimeAsync(900 * 1000)
    // Only the initial POST; no refresh after stop.
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})
