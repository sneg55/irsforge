import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FONTS_DIR = join(__dirname, '..', 'public', 'fonts')
const OUT = join(__dirname, '..', 'public', 'og-image.png')
const LOGO = join(__dirname, '..', '..', 'brand', 'irsforge-app-icon-dark.svg')

const HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face {
    font-family: "Source Serif 4";
    src: url("file://${FONTS_DIR}/source-serif-4-variable.woff2") format("woff2-variations");
    font-weight: 100 900;
    font-style: normal;
  }
  @font-face {
    font-family: "Inter";
    src: url("file://${FONTS_DIR}/inter-variable.woff2") format("woff2-variations");
    font-weight: 100 900;
    font-style: normal;
  }
  @font-face {
    font-family: "JetBrains Mono";
    src: url("file://${FONTS_DIR}/jetbrains-mono-variable.woff2") format("woff2-variations");
    font-weight: 100 900;
    font-style: normal;
  }
  body { margin: 0; width: 1200px; height: 630px; background: #0a0e1a; background-image: radial-gradient(ellipse at top right, rgba(201,169,97,0.12), transparent 60%); color: #f5efe0; font-family: Inter, sans-serif; display: flex; flex-direction: column; justify-content: center; padding: 0 80px; box-sizing: border-box; }
  .label { font-size: 14px; letter-spacing: 0.22em; text-transform: uppercase; color: #c9a961; display: inline-block; }
  h1 { font-family: 'Source Serif 4', serif; font-weight: 400; font-size: 72px; line-height: 1.05; margin: 24px 0 0; max-width: 18ch; }
  em { font-style: italic; color: #c9a961; }
  .foot { margin-top: auto; font-size: 18px; color: #8a826f; font-family: 'JetBrains Mono', monospace; }
  </style></head><body>
  <img src="file://${LOGO}" alt="" width="64" height="64" style="border-radius:12px;margin-bottom:32px;display:block" />
  <span class="label">— Reference Implementation —</span>
  <h1>The institutional rates infrastructure <em>Canton was missing.</em></h1>
  <div class="foot">irsforge.com · open-source IRS / CDS / CCY for Canton Network</div>
</body></html>`

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  })
  await page.setContent(HTML, { waitUntil: 'networkidle' })
  // Give @font-face a moment to apply after networkidle
  await page.waitForTimeout(300)
  await page.screenshot({ path: OUT, type: 'png', clip: { x: 0, y: 0, width: 1200, height: 630 } })
  await browser.close()
  console.log(`Wrote ${OUT}`)
}

run().catch((err) => {
  console.error(err)

  process.exit(1)
})
