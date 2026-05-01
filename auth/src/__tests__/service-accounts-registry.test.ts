import assert from 'node:assert/strict'
import { before, describe, test } from 'node:test'
import bcrypt from 'bcrypt'
import { ServiceAccountsRegistry } from '../service-accounts/registry.js'

let schedulerHash: string
let markHash: string

before(async () => {
  schedulerHash = await bcrypt.hash('scheduler-secret', 10)
  markHash = await bcrypt.hash('mark-secret', 10)
})

function makeYaml(entries: Array<{ id: string; clientSecretHash: string }>): string {
  const body = entries
    .map((e) => `  - id: "${e.id}"\n    clientSecretHash: "${e.clientSecretHash}"`)
    .join('\n')
  return `accounts:\n${body}`
}

describe('ServiceAccountsRegistry.fromYaml', () => {
  test('loads valid yaml and verifies correct secret', async () => {
    const yaml = makeYaml([
      { id: 'scheduler', clientSecretHash: schedulerHash },
      { id: 'mark-publisher', clientSecretHash: markHash },
    ])
    const registry = ServiceAccountsRegistry.fromYaml(yaml)
    assert.equal(await registry.verify('scheduler', 'scheduler-secret'), true)
    assert.equal(await registry.verify('scheduler', 'wrong-secret'), false)
    assert.equal(await registry.verify('mark-publisher', 'mark-secret'), true)
  })

  test('unknown clientId returns false (no throw)', async () => {
    const yaml = makeYaml([{ id: 'scheduler', clientSecretHash: schedulerHash }])
    const registry = ServiceAccountsRegistry.fromYaml(yaml)
    assert.equal(await registry.verify('does-not-exist', 'anything'), false)
  })

  test('rejects duplicate ids', () => {
    const yaml = makeYaml([
      { id: 'scheduler', clientSecretHash: schedulerHash },
      { id: 'scheduler', clientSecretHash: markHash },
    ])
    assert.throws(() => ServiceAccountsRegistry.fromYaml(yaml), /duplicate/i)
  })

  test('rejects malformed yaml', () => {
    assert.throws(() => ServiceAccountsRegistry.fromYaml('not: [valid'), /ServiceAccounts/i)
  })

  test('rejects entry missing clientSecretHash', () => {
    assert.throws(
      () => ServiceAccountsRegistry.fromYaml('accounts:\n  - id: "scheduler"'),
      /clientSecretHash/,
    )
  })

  test('timing: unknown clientId still runs bcrypt.compare (no short-circuit)', async () => {
    const yaml = makeYaml([{ id: 'scheduler', clientSecretHash: schedulerHash }])
    const registry = ServiceAccountsRegistry.fromYaml(yaml)
    // Measure known-id wrong-secret vs unknown-id.
    // We don't assert absolute timing — only that the unknown-id path
    // takes at least an order of magnitude longer than an immediate return
    // (bcrypt cost 10 is ~50-500ms; a short-circuit return is <1ms).
    const t0 = performance.now()
    await registry.verify('does-not-exist', 'anything')
    const elapsed = performance.now() - t0
    assert.ok(elapsed > 10, `expected bcrypt work on unknown id, took only ${elapsed}ms`)
  })
})
