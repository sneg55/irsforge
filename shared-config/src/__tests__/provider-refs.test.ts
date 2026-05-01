import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { curveProviderRefSchema, projectionCurveRefSchema } from '../schema.js'

// curveProviderRefSchema previously used z.enum(['nyfed','demo-stub']) which
// silently rejected any third-party provider id. After T11 the schema accepts
// any well-formed lowercase-hyphenated id; the *registered* set is validated
// at oracle startup against the runtime registry (see oracle/src/index.ts +
// providers/registry.ts validateProviderRefs).
describe('curveProviderRefSchema', () => {
  it('accepts an unknown but well-formed id', () => {
    const result = curveProviderRefSchema.safeParse({ provider: 'redstone' })
    assert.equal(result.success, true)
  })

  it('accepts the built-in ids', () => {
    assert.equal(curveProviderRefSchema.safeParse({ provider: 'nyfed' }).success, true)
    assert.equal(curveProviderRefSchema.safeParse({ provider: 'demo-stub' }).success, true)
  })

  it('rejects empty id', () => {
    assert.equal(curveProviderRefSchema.safeParse({ provider: '' }).success, false)
  })

  it('rejects uppercase / underscore', () => {
    assert.equal(curveProviderRefSchema.safeParse({ provider: 'NYFED' }).success, false)
    assert.equal(curveProviderRefSchema.safeParse({ provider: 'demo_stub' }).success, false)
  })

  it('rejects ids starting with a digit or hyphen', () => {
    assert.equal(curveProviderRefSchema.safeParse({ provider: '1nyfed' }).success, false)
    assert.equal(curveProviderRefSchema.safeParse({ provider: '-nyfed' }).success, false)
  })
})

describe('projectionCurveRefSchema', () => {
  it('inherits the provider regex via curveProviderRefSchema extension', () => {
    assert.equal(
      projectionCurveRefSchema.safeParse({ provider: 'redstone', indexId: 'USD-SOFR' }).success,
      true,
    )
    assert.equal(
      projectionCurveRefSchema.safeParse({ provider: 'NYFED', indexId: 'USD-SOFR' }).success,
      false,
    )
  })
})
