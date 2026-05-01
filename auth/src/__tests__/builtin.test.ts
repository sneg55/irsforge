import assert from 'node:assert/strict'
import { before, describe, test } from 'node:test'
import bcrypt from 'bcrypt'
import type { Org } from 'irsforge-shared-config'
import { BuiltinProvider } from '../providers/builtin.js'

const TEST_ORGS: Org[] = [
  {
    id: 'goldman',
    party: 'PartyA::abc123',
    displayName: 'Goldman Sachs',
    hint: 'goldman',
    ledgerUrl: 'http://localhost:6865',
    subdomain: 'goldman',
  },
  {
    id: 'jpmorgan',
    party: 'PartyB::def456',
    displayName: 'JP Morgan',
    hint: 'jpmorgan',
    ledgerUrl: 'http://localhost:6865',
  },
]

let goldmanHash: string
let jpmorganHash: string

before(async () => {
  goldmanHash = await bcrypt.hash('goldman123', 10)
  jpmorganHash = await bcrypt.hash('jpmorgan123', 10)
})

function makeYaml(
  users: Array<{
    username: string
    passwordHash: string
    orgId: string
    actAs: string[]
    readAs?: string[]
  }>,
): string {
  const entries = users.map((u) => {
    const readAsLine = u.readAs ? `\n    readAs: [${u.readAs.map((r) => `"${r}"`).join(', ')}]` : ''
    return `  - username: "${u.username}"\n    passwordHash: "${u.passwordHash}"\n    orgId: "${u.orgId}"\n    actAs: [${u.actAs.map((a) => `"${a}"`).join(', ')}]${readAsLine}`
  })
  return `users:\n${entries.join('\n')}`
}

describe('BuiltinProvider', () => {
  describe('authenticate — success', () => {
    test('returns correct AuthResult for valid credentials', async () => {
      const yaml = makeYaml([
        {
          username: 'admin',
          passwordHash: goldmanHash,
          orgId: 'goldman',
          actAs: ['PartyA::abc123'],
        },
      ])
      const provider = await BuiltinProvider.fromUsersYaml(yaml, TEST_ORGS)

      const result = await provider.authenticate({
        username: 'admin',
        password: 'goldman123',
        orgId: 'goldman',
      })

      assert.equal(result.userId, 'admin::goldman')
      assert.equal(result.orgId, 'goldman')
      assert.equal(result.party, 'PartyA::abc123')
      assert.deepEqual(result.actAs, ['PartyA::abc123'])
      assert.deepEqual(result.readAs, ['PartyA::abc123'])
    })

    test('readAs defaults to actAs when empty in yaml', async () => {
      const yaml = makeYaml([
        {
          username: 'admin',
          passwordHash: goldmanHash,
          orgId: 'goldman',
          actAs: ['PartyA::abc123'],
        },
      ])
      const provider = await BuiltinProvider.fromUsersYaml(yaml, TEST_ORGS)
      const result = await provider.authenticate({
        username: 'admin',
        password: 'goldman123',
        orgId: 'goldman',
      })
      assert.deepEqual(result.readAs, result.actAs)
    })

    test('readAs is used when explicitly provided', async () => {
      const yaml = makeYaml([
        {
          username: 'admin',
          passwordHash: goldmanHash,
          orgId: 'goldman',
          actAs: ['PartyA::abc123'],
          readAs: ['PartyA::abc123', 'Public::xyz'],
        },
      ])
      const provider = await BuiltinProvider.fromUsersYaml(yaml, TEST_ORGS)
      const result = await provider.authenticate({
        username: 'admin',
        password: 'goldman123',
        orgId: 'goldman',
      })
      assert.deepEqual(result.readAs, ['PartyA::abc123', 'Public::xyz'])
    })

    test('authenticates second org independently', async () => {
      const yaml = makeYaml([
        {
          username: 'admin',
          passwordHash: jpmorganHash,
          orgId: 'jpmorgan',
          actAs: ['PartyB::def456'],
        },
      ])
      const provider = await BuiltinProvider.fromUsersYaml(yaml, TEST_ORGS)
      const result = await provider.authenticate({
        username: 'admin',
        password: 'jpmorgan123',
        orgId: 'jpmorgan',
      })
      assert.equal(result.party, 'PartyB::def456')
      assert.equal(result.orgId, 'jpmorgan')
    })
  })

  describe('authenticate — failure', () => {
    test('rejects unknown user', async () => {
      const yaml = makeYaml([
        {
          username: 'admin',
          passwordHash: goldmanHash,
          orgId: 'goldman',
          actAs: ['PartyA::abc123'],
        },
      ])
      const provider = await BuiltinProvider.fromUsersYaml(yaml, TEST_ORGS)
      await assert.rejects(
        () =>
          provider.authenticate({ username: 'nobody', password: 'goldman123', orgId: 'goldman' }),
        /Invalid credentials/,
      )
    })

    test('rejects wrong org for valid user+password', async () => {
      const yaml = makeYaml([
        {
          username: 'admin',
          passwordHash: goldmanHash,
          orgId: 'goldman',
          actAs: ['PartyA::abc123'],
        },
      ])
      const provider = await BuiltinProvider.fromUsersYaml(yaml, TEST_ORGS)
      await assert.rejects(
        () =>
          provider.authenticate({ username: 'admin', password: 'goldman123', orgId: 'jpmorgan' }),
        /Invalid credentials/,
      )
    })

    test('rejects wrong password', async () => {
      const yaml = makeYaml([
        {
          username: 'admin',
          passwordHash: goldmanHash,
          orgId: 'goldman',
          actAs: ['PartyA::abc123'],
        },
      ])
      const provider = await BuiltinProvider.fromUsersYaml(yaml, TEST_ORGS)
      await assert.rejects(
        () =>
          provider.authenticate({ username: 'admin', password: 'wrongpassword', orgId: 'goldman' }),
        /Invalid credentials/,
      )
    })

    test('rejects when org exists in yaml but not in orgs config', async () => {
      const yaml = makeYaml([
        {
          username: 'admin',
          passwordHash: goldmanHash,
          orgId: 'unknown-org',
          actAs: ['SomeParty'],
        },
      ])
      // Pass an orgs list that doesn't include "unknown-org"
      const provider = await BuiltinProvider.fromUsersYaml(yaml, TEST_ORGS)
      await assert.rejects(
        () =>
          provider.authenticate({
            username: 'admin',
            password: 'goldman123',
            orgId: 'unknown-org',
          }),
        /Invalid credentials/,
      )
    })
  })
})
