import { expect, test } from '@playwright/test'

test.describe('homepage', () => {
  test('loads with title and CTAs', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/IRSForge/)
    await expect(page.getByRole('link', { name: /live demo/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /talk to the team/i }).first()).toBeVisible()
  })

  test('renders all 11 sections in the new ordering', async ({ page }) => {
    await page.goto('/')
    const ids = await page
      .locator('main section[id]')
      .evaluateAll((els) => els.map((e) => (e as HTMLElement).id))
    expect(ids).toEqual([
      'gap',
      'what',
      'parity',
      'pedigree',
      'tour',
      'architecture',
      'vs',
      'audience',
      'deploy',
      'faq',
    ])
  })

  test('contains key positioning text', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(/\$9 trillion/i).first()).toBeVisible()
    await expect(page.getByText(/three swap families/i).first()).toBeVisible()
    await expect(page.getByText(/three moving parts/i).first()).toBeVisible()
    await expect(page.getByText(/five seats at the table/i).first()).toBeVisible()
  })

  test('hero anchor screenshot is loaded eagerly', async ({ page }) => {
    await page.goto('/')
    const heroImg = page.locator('.hero figure.frame img').first()
    await expect(heroImg).toBeVisible()
    const loading = await heroImg.getAttribute('loading')
    expect(loading).toBe('eager')
  })

  test('product cards expose maturity pills', async ({ page }) => {
    await page.goto('/')
    // Pill labels come from ProductCard.astro maturityLabel map.
    await expect(page.getByText(/^Reference impl$/).first()).toBeVisible()
  })

  test('FAQ surfaces honest caveats', async ({ page }) => {
    await page.goto('/')
    // Open all <details> so the answers are queryable for substrings.
    await page.evaluate(() => {
      document.querySelectorAll('details.faq').forEach((d) => d.setAttribute('open', ''))
    })
    await expect(page.getByText(/per leg/i).first()).toBeVisible()
    await expect(page.getByText(/flat scalar stub/i).first()).toBeVisible()
    await expect(page.getByText(/CurveBook/i).first()).toBeVisible()
    await expect(page.getByText(/work on a phone/i).first()).toBeVisible()
  })

  test('audience personas link onward to relevant sections', async ({ page }) => {
    await page.goto('/')
    const audience = page.locator('#audience')
    await expect(audience.getByRole('link', { name: /see the workspace/i })).toHaveAttribute(
      'href',
      '#parity',
    )
    await expect(audience.getByRole('link', { name: /see the deploy steps/i })).toHaveAttribute(
      'href',
      '#deploy',
    )
    await expect(audience.getByRole('link', { name: /see the regulator view/i })).toHaveAttribute(
      'href',
      '#tour',
    )
  })

  test('FAQ accordions are <details> elements', async ({ page }) => {
    await page.goto('/')
    const detailsCount = await page.locator('details.faq').count()
    // src/data/faq.ts is the source of truth for FAQ entries.
    expect(detailsCount).toBeGreaterThanOrEqual(9)
  })

  test('all internal anchor links resolve', async ({ page }) => {
    await page.goto('/')
    const anchors = await page
      .locator("a[href^='#']")
      .evaluateAll((els) =>
        els.map((e) => (e as HTMLAnchorElement).getAttribute('href')!).filter(Boolean),
      )
    for (const href of anchors) {
      const id = href.replace(/^#/, '')
      if (id.length === 0) continue
      const exists = await page.locator(`#${id}`).count()
      expect(exists, `anchor target ${href}`).toBeGreaterThan(0)
    }
  })

  test('mobile viewport renders without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const overflow = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth,
      view: window.innerWidth,
    }))
    expect(overflow.doc).toBeLessThanOrEqual(overflow.view + 1)
  })

  test('em-dash check: no em or en dashes leak into marketing copy', async ({ page }) => {
    await page.goto('/')
    const text = await page.locator('main').innerText()
    expect(text, 'em dash (U+2014) found in marketing copy').not.toMatch(/—/)
    expect(text, 'en dash (U+2013) found in marketing copy').not.toMatch(/–/)
  })
})
