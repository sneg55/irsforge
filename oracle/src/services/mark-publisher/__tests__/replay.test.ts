// Reproducibility harness — Phase 5 Stage D, widened in Phase 6 Stage B.
//
// Given the latest MarkToMarket contract on a live sandbox, re-build the
// exact same PricingContext and SwapConfig from the snapshot key and
// prove shared-pricing.pricingEngine.price() yields the same exposure
// the publisher wrote. Mismatch ⇒ the harness and publisher have
// diverged — fix the source, never loosen the tolerance.
//
// Stage B widening: `resolveSwapConfig` is now a per-family dispatcher
// covering IRS / OIS / CDS / BASIS / XCCY / FPML. The `for (const cid
// of snapshot.swapCids)` loop below naturally covers every family that
// happens to be in a CSA's netting set, so this single sandbox test
// doubles as the per-family parity assertion — no separate per-family
// test file needed. Per-family seeding helpers can be added when the
// scheduler test harness (Stage C) lands.
//
// Gated on IRSFORGE_SANDBOX_RUNNING so CI without a sandbox passes
// trivially; PRs run it locally before merging.

import { pricingEngine } from '@irsforge/shared-pricing'
import { describe, expect, it } from 'vitest'
import { LedgerClient } from '../../../shared/ledger-client.js'
import { CSA_TEMPLATE_ID, MARK_TEMPLATE_ID } from '../../../shared/template-ids.js'
import type { CsaPayload, MarkToMarketPayload } from '../../../shared/types.js'
import { decodeCsa } from '../decode.js'
import { buildContextFromSnapshot, resolveSwapConfig } from '../replay.js'

const shouldRun = process.env['IRSFORGE_SANDBOX_RUNNING'] === '1'

describe.skipIf(!shouldRun)('reproducibility replay', () => {
  it('publisher mark = direct shared-pricing compute (latest mark)', async () => {
    const client = new LedgerClient(process.env['OPERATOR_TOKEN'])

    const marks = (await client.query(MARK_TEMPLATE_ID)) as Array<{
      contractId: string
      payload: MarkToMarketPayload
    }>
    expect(marks.length).toBeGreaterThan(0)
    const latest = marks.slice().sort((a, b) => (a.payload.asOf < b.payload.asOf ? 1 : -1))[0]

    const snapshot = JSON.parse(latest.payload.snapshot) as {
      curveCids: string[]
      indexCids: string[]
      observationCutoff: string
      swapCids: string[]
    }

    const csas = (await client.query(CSA_TEMPLATE_ID)) as Array<{
      contractId: string
      payload: CsaPayload
    }>
    const csaRaw = csas.find((c) => c.contractId === latest.payload.csaCid)
    expect(csaRaw, `CSA ${latest.payload.csaCid} not found on ledger`).toBeTruthy()
    const csa = decodeCsa(csaRaw!.contractId, csaRaw!.payload)

    const ctx = await buildContextFromSnapshot(client, snapshot, csa.valuationCcy)

    const pvs: number[] = []
    for (const cid of snapshot.swapCids) {
      const cfg = await resolveSwapConfig(client, cid)
      const { npv } = pricingEngine.price(cfg, ctx)
      pvs.push(npv)
    }
    const sumPa = pvs.reduce((a, b) => a + b, 0)
    // Publisher sign convention: positive exposure ⇒ A owes B, i.e.
    // exposure = -sum(PA-perspective PVs). compute.ts:38.
    const directExposure = -sumPa

    const recordedExposure = parseFloat(latest.payload.exposure)
    expect(directExposure).toBeCloseTo(recordedExposure, 2) // within 1 cent
  })
})
