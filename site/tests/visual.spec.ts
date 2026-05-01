import { expect, test } from '@playwright/test'

const sections = [
  { id: 'hero', selector: '.hero' },
  { id: 'gap', selector: '#gap' },
  { id: 'vs', selector: '#vs' },
  { id: 'what', selector: '#what' },
  { id: 'parity', selector: '#parity' },
  { id: 'tour', selector: '#tour' },
  { id: 'architecture', selector: '#architecture' },
  { id: 'pedigree', selector: '#pedigree' },
  { id: 'audience', selector: '#audience' },
  { id: 'deploy', selector: '#deploy' },
  { id: 'faq', selector: '#faq' },
] as const

const breakpoints = [
  { name: 'desktop', viewport: { width: 1440, height: 900 } },
  { name: 'tablet', viewport: { width: 900, height: 1200 } },
  { name: 'mobile', viewport: { width: 390, height: 844 } },
] as const

for (const bp of breakpoints) {
  test.describe(`visual snapshots @ ${bp.name}`, () => {
    test.use({ viewport: bp.viewport })

    for (const s of sections) {
      test(`${s.id}`, async ({ page }) => {
        await page.goto('/')
        await page.waitForLoadState('networkidle')
        await page.addStyleTag({
          content:
            '*, *::before, *::after { animation: none !important; transition: none !important; }',
        })
        const target = page.locator(s.selector).first()
        await target.scrollIntoViewIfNeeded()
        await expect(target).toHaveScreenshot(`${s.id}-${bp.name}.png`, {
          maxDiffPixelRatio: 0.02,
        })
      })
    }
  })
}
