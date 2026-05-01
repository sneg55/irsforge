import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'src', 'assets', 'screenshots')

// eslint-disable-next-line no-restricted-properties -- standalone CLI script, env is the correct boundary
const BASE = process.env.DEMO_URL ?? 'https://demo.irsforge.com'

const captures = [
  {
    name: 'workspace',
    path: '/org/demo/workspace',
    clip: { x: 0, y: 0, width: 1440, height: 900 },
  },
  { name: 'blotter', path: '/org/demo/blotter', clip: { x: 0, y: 0, width: 1440, height: 900 } },
  { name: 'csa', path: '/org/demo/csa', clip: { x: 0, y: 0, width: 1440, height: 900 } },
  { name: 'lifecycle', path: '/org/demo/ledger', clip: { x: 0, y: 0, width: 1440, height: 900 } },
  { name: 'tour-1', path: '/org/demo/workspace', clip: null },
  { name: 'tour-2', path: '/org/demo/workspace?action=propose', clip: null },
  { name: 'tour-3', path: '/org/demo/csa', clip: null },
  { name: 'tour-4', path: '/org/demo/workspace?panel=oracle', clip: null },
  { name: 'tour-5', path: '/org/demo/ledger?phase=settle', clip: null },
  { name: 'tour-6', path: '/org/demo/operator', clip: null },
]

async function run() {
  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
  })
  const page = await context.newPage()
  for (const c of captures) {
    const url = `${BASE}${c.path}`
    process.stdout.write(`Capture ${c.name} ← ${url} ... `)
    await page.goto(url, { waitUntil: 'networkidle' })
    await page.waitForTimeout(800)
    const path = join(OUT, `${c.name}.png`)
    if (c.clip) {
      await page.screenshot({ path, clip: c.clip })
    } else {
      await page.screenshot({ path, fullPage: false })
    }
    console.log('ok')
  }
  await browser.close()
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
