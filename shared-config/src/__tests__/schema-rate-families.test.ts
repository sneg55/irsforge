import assert from 'node:assert/strict'
import { test } from 'node:test'
import { rateFamiliesSchema } from '../schema-rate-families.js'

test('rate families — parses a SOFR family with tenors', () => {
  const parsed = rateFamiliesSchema.parse({
    SOFR: {
      curveIndexId: 'SOFR/INDEX',
      overnightIndexId: 'SOFR/ON',
      tenors: [
        { id: 'SOFR/ON', days: 1 },
        { id: 'SOFR/1Y', days: 365 },
      ],
    },
  })
  assert.equal(parsed.SOFR.curveIndexId, 'SOFR/INDEX')
  assert.equal(parsed.SOFR.tenors[1].days, 365)
})

test('rate families — rejects empty tenor list', () => {
  assert.throws(() =>
    rateFamiliesSchema.parse({
      SOFR: { curveIndexId: 'X', overnightIndexId: 'Y', tenors: [] },
    }),
  )
})

test('rate families — rejects duplicate tenor ids within a family', () => {
  assert.throws(() =>
    rateFamiliesSchema.parse({
      SOFR: {
        curveIndexId: 'X',
        overnightIndexId: 'Y',
        tenors: [
          { id: 'SOFR/ON', days: 1 },
          { id: 'SOFR/ON', days: 2 },
        ],
      },
    }),
  )
})
