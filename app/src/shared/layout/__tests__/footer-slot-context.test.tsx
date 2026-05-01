import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
import {
  type FooterSlotData,
  FooterSlotProvider,
  useFooterSlot,
  useSetFooterSlot,
} from '../footer-slot-context'

afterEach(() => cleanup())

function Consumer() {
  const slot = useFooterSlot()
  if (!slot) return <span data-testid="empty">empty</span>
  return (
    <span data-testid="filled">
      {`npv=${slot.valuation?.npv ?? 'null'} ccy=${slot.curve?.currency ?? 'null'}`}
    </span>
  )
}

function Writer({ data }: { data: FooterSlotData }) {
  useSetFooterSlot(data)
  return null
}

describe('FooterSlotContext', () => {
  test('useFooterSlot outside provider returns null (no crash)', () => {
    const { container } = render(<Consumer />)
    expect(container.querySelector('[data-testid="empty"]')).not.toBeNull()
  })

  test('provider + consumer reads null slot initially', () => {
    const { container } = render(
      <FooterSlotProvider>
        <Consumer />
      </FooterSlotProvider>,
    )
    expect(container.querySelector('[data-testid="empty"]')).not.toBeNull()
  })

  test('useSetFooterSlot populates the slot consumer can read', () => {
    const data: FooterSlotData = {
      // minimal shapes — the context doesn't validate internals
      valuation: { npv: 1234 } as FooterSlotData['valuation'],
      swapConfig: null,
      curve: { currency: 'USD' } as FooterSlotData['curve'],
    }
    const { container } = render(
      <FooterSlotProvider>
        <Writer data={data} />
        <Consumer />
      </FooterSlotProvider>,
    )
    const el = container.querySelector('[data-testid="filled"]')
    expect(el).not.toBeNull()
    expect(el!.textContent).toContain('npv=1234')
    expect(el!.textContent).toContain('ccy=USD')
  })

  test('unmounting the writer clears the slot back to null', () => {
    const data: FooterSlotData = {
      valuation: { npv: 99 } as FooterSlotData['valuation'],
      swapConfig: null,
      curve: null,
    }
    function Harness({ show }: { show: boolean }) {
      return (
        <FooterSlotProvider>
          {show && <Writer data={data} />}
          <Consumer />
        </FooterSlotProvider>
      )
    }
    const { container, rerender } = render(<Harness show />)
    expect(container.querySelector('[data-testid="filled"]')).not.toBeNull()
    rerender(<Harness show={false} />)
    expect(container.querySelector('[data-testid="empty"]')).not.toBeNull()
  })
})
