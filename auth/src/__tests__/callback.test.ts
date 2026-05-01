import assert from 'node:assert/strict'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { describe, it } from 'node:test'
import { HandoffStore } from '../auth/handoff-store.js'
import { OidcStateStore } from '../auth/state-store.js'
import { generateKeyPair } from '../keys/manager.js'
import type { AuthProvider, AuthResult } from '../providers/interface.js'
import { handleCallback } from '../routes/callback.js'
import { RefreshTokenStore } from '../tokens/refresh.js'

function makeReqWithUrl(url: string): IncomingMessage {
  const req = new IncomingMessage(new Socket())
  req.method = 'GET'
  req.url = url
  return req
}

interface Captures {
  headers: Record<string, string>
  status?: number
}

function makeRes(): { res: ServerResponse; captures: Captures } {
  const res = new ServerResponse(new IncomingMessage(new Socket()))
  const captures: Captures = { headers: {} }
  const origWriteHead = res.writeHead.bind(res)
  res.writeHead = ((status: number, headers?: Record<string, string>) => {
    captures.status = status
    if (headers) Object.assign(captures.headers, headers)
    return origWriteHead(status, headers as never)
  }) as typeof res.writeHead
  return { res, captures }
}

function makeProvider(result: AuthResult | Error): AuthProvider {
  return {
    authenticate: async () => {
      throw new Error('not used in callback tests')
    },
    handleCallback: async (_code, _orgId, _nonce) => {
      if (result instanceof Error) throw result
      return result
    },
  }
}

const AUTH_RESULT: AuthResult = {
  userId: 'u',
  orgId: 'goldman',
  party: 'PartyA',
  actAs: ['PartyA'],
  readAs: ['PartyA'],
}

function primedStateStore(state: string, orgId: string, nonce: string): OidcStateStore {
  const store = new OidcStateStore()
  store.put(state, { orgId, nonce })
  return store
}

describe('handleCallback', () => {
  it('redirects to frontendUrlFor(orgId)/callback?handoff=<opaque> on success — no JWT in URL', async () => {
    const keys = await generateKeyPair()
    const tokenStore = new RefreshTokenStore(3600)
    const stateStore = primedStateStore('abc', 'goldman', 'n1')
    const handoffStore = new HandoffStore()
    const captured: { orgId?: string } = {}

    const req = makeReqWithUrl('/auth/callback?code=xyz&state=abc')
    const { res, captures } = makeRes()

    await handleCallback(req, res, {
      provider: makeProvider(AUTH_RESULT),
      keys,
      tokenStore,
      stateStore,
      handoffStore,
      issuer: 'https://iss.example',
      tokenTtlSeconds: 60,
      refreshTtlSeconds: 600,
      ledgerId: 'sandbox',
      applicationId: 'IRSForge',
      frontendUrlFor: (orgId) => {
        captured.orgId = orgId
        return 'https://goldman.app.example'
      },
      errorRedirectUrl: 'https://app.example',
    })

    assert.equal(captured.orgId, 'goldman')
    assert.equal(captures.status, 302)

    const location = captures.headers['Location'] ?? ''
    assert.ok(
      location.startsWith('https://goldman.app.example/org/goldman/callback?handoff='),
      `expected handoff redirect, got: ${location}`,
    )
    // The JWT must not appear anywhere in the redirect URL.
    assert.ok(!location.includes('token='), `URL must not contain token= ; got: ${location}`)
    assert.ok(!location.includes('eyJ'), `URL must not contain a JWT; got: ${location}`)

    // Defence-in-depth headers.
    assert.equal(captures.headers['Cache-Control'], 'no-store')
    assert.equal(captures.headers['Referrer-Policy'], 'no-referrer')

    // The JWT must be retrievable from the handoff store using the opaque code from the URL.
    const handoff = new URL(location).searchParams.get('handoff') ?? ''
    assert.ok(handoff.length > 0)
    const entry = handoffStore.consume(handoff)
    assert.ok(entry, 'handoff entry must exist')
    assert.match(entry.accessToken, /^[\w-]+\.[\w-]+\.[\w-]+$/)
    assert.equal(entry.userId, 'u')
    assert.equal(entry.party, 'PartyA')
    assert.equal(entry.expiresIn, 60)

    // Refresh cookie still set on this same response.
    assert.ok(captures.headers['Set-Cookie']?.startsWith('irsforge_refresh='))
  })

  it('redirects to errorRedirectUrl when provider.handleCallback throws', async () => {
    const keys = await generateKeyPair()
    const tokenStore = new RefreshTokenStore(3600)
    const stateStore = primedStateStore('abc', 'goldman', 'n1')
    const handoffStore = new HandoffStore()

    const req = makeReqWithUrl('/auth/callback?code=xyz&state=abc')
    const { res, captures } = makeRes()

    await handleCallback(req, res, {
      provider: makeProvider(new Error('boom')),
      keys,
      tokenStore,
      stateStore,
      handoffStore,
      issuer: 'https://iss.example',
      tokenTtlSeconds: 60,
      refreshTtlSeconds: 600,
      ledgerId: 'sandbox',
      applicationId: 'IRSForge',
      frontendUrlFor: () => {
        throw new Error('should not be called on error path')
      },
      errorRedirectUrl: 'https://app.example',
    })

    assert.equal(captures.status, 302)
    assert.equal(captures.headers['Location'], 'https://app.example?error=auth_failed')
  })

  it('redirects to errorRedirectUrl when code or state missing', async () => {
    const keys = await generateKeyPair()
    const tokenStore = new RefreshTokenStore(3600)
    const stateStore = new OidcStateStore()
    const handoffStore = new HandoffStore()

    const req = makeReqWithUrl('/auth/callback')
    const { res, captures } = makeRes()

    await handleCallback(req, res, {
      provider: makeProvider(AUTH_RESULT),
      keys,
      tokenStore,
      stateStore,
      handoffStore,
      issuer: 'https://iss.example',
      tokenTtlSeconds: 60,
      refreshTtlSeconds: 600,
      ledgerId: 'sandbox',
      applicationId: 'IRSForge',
      frontendUrlFor: () => {
        throw new Error('should not be called on error path')
      },
      errorRedirectUrl: 'https://app.example',
    })

    assert.equal(captures.headers['Location'], 'https://app.example?error=auth_failed')
  })

  it('redirects with error=invalid_state when state is unknown to the store (CSRF defense)', async () => {
    const keys = await generateKeyPair()
    const tokenStore = new RefreshTokenStore(3600)
    const stateStore = new OidcStateStore() // empty: any state is rejected
    const handoffStore = new HandoffStore()

    const req = makeReqWithUrl('/auth/callback?code=xyz&state=attacker-supplied')
    const { res, captures } = makeRes()

    let providerCalled = false

    await handleCallback(req, res, {
      provider: {
        authenticate: async () => {
          throw new Error('not used')
        },
        handleCallback: async () => {
          providerCalled = true
          return AUTH_RESULT
        },
      },
      keys,
      tokenStore,
      stateStore,
      handoffStore,
      issuer: 'https://iss.example',
      tokenTtlSeconds: 60,
      refreshTtlSeconds: 600,
      ledgerId: 'sandbox',
      applicationId: 'IRSForge',
      frontendUrlFor: () => {
        throw new Error('should not be called on error path')
      },
      errorRedirectUrl: 'https://app.example',
    })

    assert.equal(providerCalled, false, 'provider must not be invoked when state is invalid')
    assert.equal(captures.status, 302)
    assert.equal(captures.headers['Location'], 'https://app.example?error=invalid_state')
  })

  it('rejects state replay: the same state cannot be used twice', async () => {
    const keys = await generateKeyPair()
    const tokenStore = new RefreshTokenStore(3600)
    const stateStore = primedStateStore('once', 'goldman', 'n1')
    const handoffStore = new HandoffStore()

    const ctx = {
      provider: makeProvider(AUTH_RESULT),
      keys,
      tokenStore,
      stateStore,
      handoffStore,
      issuer: 'https://iss.example',
      tokenTtlSeconds: 60,
      refreshTtlSeconds: 600,
      ledgerId: 'sandbox',
      applicationId: 'IRSForge',
      frontendUrlFor: () => 'https://goldman.app.example',
      errorRedirectUrl: 'https://app.example',
    }

    // First use succeeds.
    {
      const req = makeReqWithUrl('/auth/callback?code=xyz&state=once')
      const { res, captures } = makeRes()
      await handleCallback(req, res, ctx)
      assert.equal(captures.status, 302)
      assert.ok((captures.headers['Location'] ?? '').startsWith('https://goldman.app.example/'))
    }

    // Second use of the same state is rejected.
    {
      const req = makeReqWithUrl('/auth/callback?code=xyz&state=once')
      const { res, captures } = makeRes()
      await handleCallback(req, res, ctx)
      assert.equal(captures.headers['Location'], 'https://app.example?error=invalid_state')
    }
  })
})
