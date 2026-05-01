import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateDamlConfig, generateRateFamiliesDaml } from '../src/codegen.js'
import { loadConfig } from '../src/loader.js'

const __filename = fileURLToPath(import.meta.url)

// CLI guard — run side effects only when executed directly, not on import.
if (process.argv[1] === __filename) {
  const configPath =
    process.env['IRSFORGE_CONFIG_PATH'] ?? resolve(dirname(__filename), '../../irsforge.yaml')
  const config = loadConfig(configPath)
  const out = generateDamlConfig({
    currencies: config.currencies,
    cdsReferenceNames: config.cds?.referenceNames ?? [],
    scheduleDefaults: config.scheduleDefaults,
    csa: {
      thresholdDirA: config.csa.threshold.DirA,
      thresholdDirB: config.csa.threshold.DirB,
      mta: config.csa.mta,
      rounding: config.csa.rounding,
      valuationCcy: config.csa.valuationCcy,
      eligibleCollateral: config.csa.eligibleCollateral,
    },
    demoCsaInitialFunding: config.demo?.csa?.initialFunding ?? {},
    schedulerPartyHint: config.parties.scheduler.partyHint,
    operatorPolicy: config.operator.policy,
  })
  // The script is invoked from shared-config/ (cwd) but writes the file
  // relative to the repo root, which is one directory up.
  const target = resolve(dirname(__filename), '../../contracts/src/Setup/GeneratedConfig.daml')
  writeFileSync(target, out, 'utf8')
  console.log(`[codegen] wrote ${target}`)

  const rateFamiliesOut = generateRateFamiliesDaml(config.rateFamilies)
  const rateFamiliesTarget = resolve(
    dirname(__filename),
    '../../contracts/src/Setup/GeneratedRateFamilies.daml',
  )
  writeFileSync(rateFamiliesTarget, rateFamiliesOut, 'utf8')
  console.log(`[codegen] wrote ${rateFamiliesTarget}`)
}
