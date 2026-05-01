import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateRateFamiliesTs } from '../src/codegen.js'
import { loadConfig } from '../src/loader.js'

const __filename = fileURLToPath(import.meta.url)

if (process.argv[1] === __filename) {
  const configPath =
    process.env['IRSFORGE_CONFIG_PATH'] ?? resolve(dirname(__filename), '../../irsforge.yaml')
  const config = loadConfig(configPath)
  const out = generateRateFamiliesTs(config.rateFamilies)
  const target = resolve(dirname(__filename), '../../oracle/src/shared/generated/rate-families.ts')
  writeFileSync(target, out, 'utf8')
  console.log(`[codegen] wrote ${target}`)
}
