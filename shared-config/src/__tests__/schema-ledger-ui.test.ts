import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { ledgerUiSchema } from '../schema-ledger-ui.js'

test('ledgerUiSchema applies defaults when block is empty', () => {
  const parsed = ledgerUiSchema.parse({})
  assert.equal(parsed.enabled, true)
  assert.equal(parsed.bufferSize, 500)
  assert.deepEqual(parsed.templateFilter.allow, [])
  assert.ok(parsed.templateFilter.deny.includes('Daml.Finance.Holding'))
  assert.ok(parsed.templateFilter.systemPrefixes.includes('Oracle.Curve'))
  assert.ok(parsed.templateFilter.systemPrefixes.includes('Csa.Mark'))
  assert.equal(parsed.toasts.enabled, true)
  assert.equal(parsed.toasts.maxVisible, 3)
  assert.equal(parsed.toasts.dismissAfterMs, 5000)
  assert.equal(parsed.rawPayload.enabled, true)
})

test('ledgerUiSchema honours explicit overrides', () => {
  const parsed = ledgerUiSchema.parse({
    enabled: false,
    bufferSize: 100,
    templateFilter: { allow: ['Foo.Bar'], deny: [] },
    toasts: { enabled: false, maxVisible: 1, dismissAfterMs: 1000 },
    rawPayload: { enabled: false },
  })
  assert.equal(parsed.enabled, false)
  assert.equal(parsed.bufferSize, 100)
  assert.deepEqual(parsed.templateFilter.allow, ['Foo.Bar'])
  assert.equal(parsed.toasts.enabled, false)
  assert.equal(parsed.toasts.maxVisible, 1)
  assert.equal(parsed.rawPayload.enabled, false)
})

test('ledgerUiSchema rejects bufferSize below 1', () => {
  assert.throws(() => ledgerUiSchema.parse({ bufferSize: 0 }))
})

test('ledgerUiSchema rejects negative maxVisible', () => {
  assert.throws(() => ledgerUiSchema.parse({ toasts: { maxVisible: -1 } }))
})
