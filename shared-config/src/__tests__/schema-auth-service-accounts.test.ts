import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { authSchema, configSchema } from '../schema.js'
import { VALID_ORGS } from './_helpers.js'

const BUILTIN = {
  issuer: 'http://localhost:3002',
  keyAlgorithm: 'RS256',
  tokenTtlSeconds: 900,
  refreshTtlSeconds: 86400,
  port: 3002,
}

describe('authSchema.serviceAccounts', () => {
  it('defaults to empty array when absent', () => {
    const r = authSchema.safeParse({ provider: 'builtin', builtin: BUILTIN })
    assert.equal(r.success, true)

    if (r.success) assert.deepEqual(r.data.serviceAccounts, [])
  })

  it('accepts a valid scheduler service account', () => {
    const r = authSchema.safeParse({
      provider: 'builtin',
      builtin: BUILTIN,
      serviceAccounts: [{ id: 'scheduler', actAs: ['Scheduler'], readAs: ['PartyA', 'PartyB'] }],
    })
    assert.equal(r.success, true)
  })

  it('rejects entry with empty id', () => {
    const r = authSchema.safeParse({
      provider: 'builtin',
      builtin: BUILTIN,
      serviceAccounts: [{ id: '', actAs: ['Scheduler'] }],
    })
    assert.equal(r.success, false)
  })

  it('rejects entry with empty actAs', () => {
    const r = authSchema.safeParse({
      provider: 'builtin',
      builtin: BUILTIN,
      serviceAccounts: [{ id: 'scheduler', actAs: [] }],
    })
    assert.equal(r.success, false)
  })

  it('defaults readAs to empty array', () => {
    const r = authSchema.safeParse({
      provider: 'builtin',
      builtin: BUILTIN,
      serviceAccounts: [{ id: 'scheduler', actAs: ['Scheduler'] }],
    })
    assert.equal(r.success, true)

    if (r.success) assert.deepEqual(r.data.serviceAccounts[0].readAs, [])
  })

  it('rejects duplicate service account ids', () => {
    const r = authSchema.safeParse({
      provider: 'builtin',
      builtin: BUILTIN,
      serviceAccounts: [
        { id: 'scheduler', actAs: ['Scheduler'] },
        { id: 'scheduler', actAs: ['OtherParty'] },
      ],
    })
    assert.equal(r.success, false)

    if (!r.success) {
      assert.ok(
        r.error.issues.some((i) => i.path.includes('serviceAccounts')),
        'expected issue on path containing serviceAccounts',
      )
    }
  })
})

const MIN_CONFIG = {
  profile: 'demo' as const,
  topology: 'sandbox' as const,
  routing: 'path' as const,
  auth: { provider: 'demo' as const },
  oracle: { url: 'http://localhost:3001' },
  platform: {
    authPublicUrl: 'http://localhost:3002',
    frontendUrl: 'http://localhost:3000',
  },
  daml: {},
  ledger: {},
  currencies: [{ code: 'USD', label: 'US Dollar', calendarId: 'USD', isDefault: true }],
  csa: {
    threshold: { DirA: 0, DirB: 0 },
    mta: 100000,
    rounding: 10000,
    valuationCcy: 'USD',
    eligibleCollateral: [{ currency: 'USD', haircut: 1.0 }],
  },
  orgs: VALID_ORGS,
  parties: { scheduler: { partyHint: 'Scheduler' } },
  scheduler: { enabled: false },
  operator: {},
}

describe('configSchema cross-subtree: non-demo requires service accounts', () => {
  it('passes: provider=builtin with scheduler enabled + matching service account', () => {
    const r = configSchema.safeParse({
      ...MIN_CONFIG,
      auth: {
        provider: 'builtin',
        builtin: BUILTIN,
        serviceAccounts: [
          { id: 'scheduler', actAs: ['Scheduler'] },
          { id: 'mark-publisher', actAs: ['Operator'] },
        ],
      },
      scheduler: { enabled: true },
    })
    assert.equal(r.success, true, r.success ? '' : JSON.stringify(r.error.issues))
  })

  it('fails: builtin + scheduler enabled WITHOUT scheduler service account', () => {
    const r = configSchema.safeParse({
      ...MIN_CONFIG,
      auth: {
        provider: 'builtin',
        builtin: BUILTIN,
        serviceAccounts: [{ id: 'mark-publisher', actAs: ['Operator'] }],
      },
      scheduler: { enabled: true },
    })
    assert.equal(r.success, false)

    if (!r.success) {
      const msgs = r.error.issues.map((i) => i.message).join('\n')
      assert.ok(/scheduler/.test(msgs), `expected scheduler message, got: ${msgs}`)
    }
  })

  it('fails: builtin WITHOUT mark-publisher service account (always required when !demo)', () => {
    const r = configSchema.safeParse({
      ...MIN_CONFIG,
      auth: {
        provider: 'builtin',
        builtin: BUILTIN,
        serviceAccounts: [{ id: 'scheduler', actAs: ['Scheduler'] }],
      },
      scheduler: { enabled: true },
    })
    assert.equal(r.success, false)

    if (!r.success) {
      const msgs = r.error.issues.map((i) => i.message).join('\n')
      assert.ok(/mark-publisher/.test(msgs), `expected mark-publisher message, got: ${msgs}`)
    }
  })

  it('passes: provider=demo requires no service accounts', () => {
    const r = configSchema.safeParse({ ...MIN_CONFIG, scheduler: { enabled: true } })
    assert.equal(r.success, true, r.success ? '' : JSON.stringify(r.error.issues))
  })
})
