import assert from 'node:assert/strict'
import { dirname, resolve } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { loadConfig } from '../loader.js'

// Regression guard: the committed `irsforge.yaml` at the repo root must
// always validate against the current schema. If a schema change lands
// without updating the reference YAML, this fails loudly.
const here = dirname(fileURLToPath(import.meta.url))
const IRSFORGE_YAML = resolve(here, '../../../irsforge.yaml')

describe('loadConfig — reference irsforge.yaml', () => {
  it("parses the repo's root irsforge.yaml without errors", () => {
    const config = loadConfig(IRSFORGE_YAML)
    // Spot-check the fields Phase 0 migrated into YAML so a schema
    // change that drops a field is caught here, not only in the UI.
    assert.equal(config.profile, 'demo')
    assert.deepEqual(config.cds?.referenceNames, ['TSLA'])
    assert.equal(config.observables.IRS.enabled, true)
    assert.equal(config.observables.ASSET.enabled, false)
    assert.equal(config.demo?.cdsStub?.defaultProb, 0.02)
    assert.equal(config.demo?.cdsStub?.recovery, 0.4)
  })
})
