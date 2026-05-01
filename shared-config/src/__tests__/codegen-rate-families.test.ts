import assert from 'node:assert/strict'
import { test } from 'node:test'
import { generateRateFamiliesDaml, generateRateFamiliesTs } from '../codegen.js'

test('rate families Daml — emits curve+overnight ids and tenor list', () => {
  const out = generateRateFamiliesDaml({
    SOFR: {
      curveIndexId: 'SOFR/INDEX',
      overnightIndexId: 'SOFR/ON',
      tenors: [
        { id: 'SOFR/ON', days: 1 },
        { id: 'SOFR/1Y', days: 365 },
      ],
    },
  })
  assert.match(out, /module Setup\.GeneratedRateFamilies where/)
  assert.match(out, /sofrIndexRateId : Text\s*\nsofrIndexRateId = "SOFR\/INDEX"/)
  assert.match(out, /sofrOvernightRateId = "SOFR\/ON"/)
  assert.match(out, /sofrTenorRateIds : \[Text\]/)
  assert.match(out, /"SOFR\/ON"/)
  assert.match(out, /"SOFR\/1Y"/)
})

test('rate families Daml — lowercases family name for identifier prefix', () => {
  const out = generateRateFamiliesDaml({
    ESTR: {
      curveIndexId: 'ESTR/INDEX',
      overnightIndexId: 'ESTR/ON',
      tenors: [{ id: 'ESTR/ON', days: 1 }],
    },
  })
  assert.match(out, /estrIndexRateId = "ESTR\/INDEX"/)
  assert.match(out, /estrOvernightRateId = "ESTR\/ON"/)
})

test('rate families TS — emits constants + TENOR_DAYS map', () => {
  const out = generateRateFamiliesTs({
    SOFR: {
      curveIndexId: 'SOFR/INDEX',
      overnightIndexId: 'SOFR/ON',
      tenors: [
        { id: 'SOFR/ON', days: 1 },
        { id: 'SOFR/1Y', days: 365 },
      ],
    },
  })
  assert.match(out, /export const SOFR_INDEX_RATE_ID = 'SOFR\/INDEX'/)
  assert.match(out, /export const SOFR_OVERNIGHT_RATE_ID = 'SOFR\/ON'/)
  assert.match(out, /export const SOFR_TENOR_RATE_IDS =/)
  assert.match(out, /'SOFR\/ON': 1/)
  assert.match(out, /'SOFR\/1Y': 365/)
})
