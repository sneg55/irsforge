import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { CdsPanel } from '../cds-panel'

afterEach(() => cleanup())

describe('CdsPanel', () => {
  test('renders the credit spread in bp', () => {
    const { container } = render(
      <CdsPanel creditSpread={0.0125} editable={false} onChange={vi.fn()} />,
    )
    expect(container.textContent).toContain('125')
    expect(container.textContent).toContain('bp')
  })

  test('editable: typing a new bp value fires onChange with decimal conversion', () => {
    const onChange = vi.fn()
    const { container } = render(<CdsPanel creditSpread={0.01} editable onChange={onChange} />)
    // Click the display to enter edit mode
    const display = container.querySelector('span[class*="cursor-pointer"]') as HTMLElement
    fireEvent.click(display)
    const input = container.querySelector('input') as HTMLInputElement
    fireEvent.change(input, { target: { value: '250' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalled()
    const lastArg = onChange.mock.calls[onChange.mock.calls.length - 1][0]
    expect(lastArg).toBeCloseTo(0.025)
  })
})
