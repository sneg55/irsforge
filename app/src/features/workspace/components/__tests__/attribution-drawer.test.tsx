import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { AttributionDrawer } from '../attribution-drawer'

afterEach(() => cleanup())

describe('AttributionDrawer', () => {
  test('disabled in draft mode — click is a no-op', () => {
    const { container } = render(
      <AttributionDrawer
        mode="draft"
        swapConfig={null}
        pricingCtx={null}
        curveHistory={[]}
        streamStatus="idle"
      />,
    )
    const header = container.querySelector('[data-testid="attr-header"]')!
    expect(header.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(header)
    expect(container.querySelector('[data-testid="attr-body"]')).toBeNull()
  })

  test('live mode — click expands, click again collapses', () => {
    const { container } = render(
      <AttributionDrawer
        mode="live"
        swapConfig={null}
        pricingCtx={null}
        curveHistory={[]}
        streamStatus="idle"
      />,
    )
    const header = container.querySelector('[data-testid="attr-header"]')!
    expect(container.querySelector('[data-testid="attr-body"]')).toBeNull()
    fireEvent.click(header)
    expect(container.querySelector('[data-testid="attr-body"]')).not.toBeNull()
    fireEvent.click(header)
    expect(container.querySelector('[data-testid="attr-body"]')).toBeNull()
  })

  test('live mode — renders summary prop in collapsed header', () => {
    const { container } = render(
      <AttributionDrawer
        mode="live"
        summary="+842k since open"
        swapConfig={null}
        pricingCtx={null}
        curveHistory={[]}
        streamStatus="idle"
      />,
    )
    const header = container.querySelector('[data-testid="attr-header"]')!
    expect(header.textContent).toContain('+842k since open')
  })
})
