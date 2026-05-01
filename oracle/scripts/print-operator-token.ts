// Mint a demo Operator JWT and print it to stdout. One-shot helper for
// out-of-band tools (e.g. the Stage D replay harness) that need to talk
// to the JSON API without pulling the oracle in as a library.
//
// Reuses the exact two-step bootstrap mintDemoOperatorToken does so the
// emitted token is identical to what the running oracle holds.
import { resolve } from 'node:path'
import { loadConfig } from 'irsforge-shared-config'
import { mintDemoOperatorToken } from '../src/authz/mint-demo-token.js'

const configPath = process.env['IRSFORGE_CONFIG_PATH'] ?? resolve(process.cwd(), '../irsforge.yaml')
const config = loadConfig(configPath)
const token = await mintDemoOperatorToken(config)
if (!token) {
  console.error('mint failed: Canton unreachable or Operator not allocated')
  process.exit(1)
}
process.stdout.write(token)
