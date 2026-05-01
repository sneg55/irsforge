// @vitest-environment node

import * as jose from 'jose'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { ClientConfig } from '../config/client'

let fetchMock: ReturnType<typeof vi.fn>

const DEMO_CONFIG: ClientConfig = {
  topology: 'sandbox',
  routing: 'path',
  auth: { provider: 'demo' },
  daml: {
    ledgerId: 'sandbox',
    applicationId: 'IRSForge',
    unsafeJwtSecret: 'secret',
  },
  orgs: [
    {
      id: 'goldman',
      party: 'PartyA',
      displayName: 'Goldman',
      hint: 'PartyA',
      role: 'trader',
      ledgerUrl: 'http://localhost:7575',
    },
  ],
}

beforeEach(() => {
  fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.resetModules()
})

// Re-import fresh each test to reset the module-level partyCache
async function importFresh() {
  vi.resetModules()
  return await import('./parties')
}

describe('generatePartyToken', () => {
  test('produces a valid HS256 JWT with Daml claims', async () => {
    const { generatePartyToken } = await importFresh()

    // Ledger not available — falls back to hints as party IDs
    fetchMock.mockRejectedValue(new Error('network error'))

    const token = await generatePartyToken(DEMO_CONFIG, ['PartyA'], ['PartyB'])
    const secret = new TextEncoder().encode('secret')
    const { payload } = await jose.jwtVerify(token, secret)

    const claims = payload['https://daml.com/ledger-api'] as Record<string, unknown>
    expect(claims.ledgerId).toBe('sandbox')
    expect(claims.applicationId).toBe('IRSForge')
    expect(claims.actAs).toEqual(['PartyA'])
    expect(claims.readAs).toEqual(['PartyB'])
  })

  test('uses ledgerId/applicationId from config', async () => {
    const { generatePartyToken } = await importFresh()
    fetchMock.mockRejectedValue(new Error('network'))

    const customConfig: ClientConfig = {
      ...DEMO_CONFIG,
      daml: { ledgerId: 'custom-ledger', applicationId: 'CustomApp', unsafeJwtSecret: 'hunter2' },
    }

    const token = await generatePartyToken(customConfig, ['PartyA'])
    const secret = new TextEncoder().encode('hunter2')
    const { payload } = await jose.jwtVerify(token, secret)

    const claims = payload['https://daml.com/ledger-api'] as Record<string, unknown>
    expect(claims.ledgerId).toBe('custom-ledger')
    expect(claims.applicationId).toBe('CustomApp')
  })

  test('refuses to run when provider is not demo', async () => {
    const { generatePartyToken } = await importFresh()
    const builtinConfig: ClientConfig = {
      ...DEMO_CONFIG,
      auth: { provider: 'builtin', builtin: { issuer: 'http://localhost:3002' } },
    }

    await expect(generatePartyToken(builtinConfig, ['PartyA'])).rejects.toThrow(
      /only valid in demo mode/,
    )
  })

  test('refuses to run when unsafeJwtSecret is missing', async () => {
    const { generatePartyToken } = await importFresh()
    const noSecretConfig: ClientConfig = {
      ...DEMO_CONFIG,
      daml: { ledgerId: 'sandbox', applicationId: 'IRSForge' },
    }

    await expect(generatePartyToken(noSecretConfig, ['PartyA'])).rejects.toThrow(
      /only valid in demo mode/,
    )
  })

  test('resolves party hints via /v1/parties when ledger is available', async () => {
    const { generatePartyToken } = await importFresh()

    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          result: [
            { identifier: 'PartyA::1220abc', displayName: 'Goldman Sachs' },
            { identifier: 'PartyB::1220abc', displayName: 'JPMorgan' },
          ],
        }),
    })

    const token = await generatePartyToken(DEMO_CONFIG, ['PartyA'])
    const secret = new TextEncoder().encode('secret')
    const { payload } = await jose.jwtVerify(token, secret)

    const claims = payload['https://daml.com/ledger-api'] as Record<string, unknown>
    expect(claims.actAs).toEqual(['PartyA::1220abc'])
  })

  test('caches party resolution across calls', async () => {
    const { generatePartyToken } = await importFresh()

    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          result: [{ identifier: 'PartyA::1220abc', displayName: 'Goldman Sachs' }],
        }),
    })

    await generatePartyToken(DEMO_CONFIG, ['PartyA'])
    await generatePartyToken(DEMO_CONFIG, ['PartyA'])

    // /v1/parties only called once (bootstrap), not twice
    const partyCalls = fetchMock.mock.calls.filter((c) => {
      const body = JSON.parse(c[1]?.body ?? '{}')
      return body.path === '/v1/parties'
    })
    expect(partyCalls.length).toBe(1)
  })

  test('resolves by displayName too', async () => {
    const { generatePartyToken } = await importFresh()

    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          result: [{ identifier: 'PartyA::1220abc', displayName: 'Goldman Sachs' }],
        }),
    })

    const token = await generatePartyToken(DEMO_CONFIG, ['Goldman Sachs'])
    const secret = new TextEncoder().encode('secret')
    const { payload } = await jose.jwtVerify(token, secret)

    const claims = payload['https://daml.com/ledger-api'] as Record<string, unknown>
    expect(claims.actAs).toEqual(['PartyA::1220abc'])
  })

  test('defaults readAs to empty array', async () => {
    const { generatePartyToken } = await importFresh()
    fetchMock.mockRejectedValue(new Error('network'))

    const token = await generatePartyToken(DEMO_CONFIG, ['PartyA'])
    const secret = new TextEncoder().encode('secret')
    const { payload } = await jose.jwtVerify(token, secret)

    const claims = payload['https://daml.com/ledger-api'] as Record<string, unknown>
    expect(claims.readAs).toEqual([])
  })

  test('falls back to raw hints when ledger returns non-ok', async () => {
    const { generatePartyToken } = await importFresh()

    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ errors: ['unauthorized'] }),
    })

    const token = await generatePartyToken(DEMO_CONFIG, ['PartyA'])
    const secret = new TextEncoder().encode('secret')
    const { payload } = await jose.jwtVerify(token, secret)

    const claims = payload['https://daml.com/ledger-api'] as Record<string, unknown>
    // Falls back to hint as-is
    expect(claims.actAs).toEqual(['PartyA'])
  })

  test('unknown hint passes through unchanged', async () => {
    const { generatePartyToken } = await importFresh()

    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          result: [{ identifier: 'PartyA::1220abc', displayName: 'Goldman Sachs' }],
        }),
    })

    const token = await generatePartyToken(DEMO_CONFIG, ['UnknownParty'])
    const secret = new TextEncoder().encode('secret')
    const { payload } = await jose.jwtVerify(token, secret)

    const claims = payload['https://daml.com/ledger-api'] as Record<string, unknown>
    expect(claims.actAs).toEqual(['UnknownParty'])
  })
})

import { FULL_ORGS } from './parties.fixtures'

describe('demoActAsReadAs', () => {
  test('PartyA login includes Operator in actAs and Regulator + PartyB in readAs', async () => {
    const { demoActAsReadAs } = await importFresh()
    expect(demoActAsReadAs('PartyA', FULL_ORGS)).toEqual({
      actAs: ['PartyA', 'Operator'],
      readAs: ['Regulator', 'PartyB'],
    })
  })

  test('PartyB login includes Operator in actAs and Regulator + PartyA in readAs', async () => {
    const { demoActAsReadAs } = await importFresh()
    expect(demoActAsReadAs('PartyB', FULL_ORGS)).toEqual({
      actAs: ['PartyB', 'Operator'],
      readAs: ['Regulator', 'PartyA'],
    })
  })

  test('Operator login does not duplicate Operator in actAs', async () => {
    const { demoActAsReadAs } = await importFresh()
    expect(demoActAsReadAs('Operator', FULL_ORGS)).toEqual({
      actAs: ['Operator'],
      readAs: ['Regulator', 'PartyA', 'PartyB'],
    })
  })

  test('Regulator login keeps Regulator in actAs (with Operator) and drops it from readAs', async () => {
    const { demoActAsReadAs } = await importFresh()
    expect(demoActAsReadAs('Regulator', FULL_ORGS)).toEqual({
      actAs: ['Regulator', 'Operator'],
      readAs: ['PartyA', 'PartyB'],
    })
  })

  test('gracefully handles empty orgs array', async () => {
    const { demoActAsReadAs } = await importFresh()
    expect(demoActAsReadAs('PartyA', [])).toEqual({
      actAs: ['PartyA', 'Operator'],
      readAs: ['Regulator'],
    })
  })

  test('does not duplicate entries when a trading party hint equals the login', async () => {
    const { demoActAsReadAs } = await importFresh()
    const oneOrg: ClientConfig['orgs'] = [
      {
        id: 'goldman',
        party: 'PartyA',
        displayName: 'Goldman Sachs',
        hint: 'PartyA',
        role: 'trader',
        ledgerUrl: 'http://localhost:7575',
      },
    ]
    expect(demoActAsReadAs('PartyA', oneOrg)).toEqual({
      actAs: ['PartyA', 'Operator'],
      readAs: ['Regulator'],
    })
  })
})
