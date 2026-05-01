import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { type FieldDef, FieldGrid } from '../field-grid'

afterEach(() => cleanup())

describe('FieldGrid — rendering', () => {
  test('renders label and value for each field', () => {
    const fields: FieldDef[] = [
      { label: 'Notional', value: 10_000_000, editable: false },
      { label: 'Rate', value: '5.00%', editable: false },
    ]
    const { container } = render(<FieldGrid fields={fields} />)
    expect(container.textContent).toContain('Notional')
    expect(container.textContent).toContain('Rate')
    // number value gets localeString formatting
    expect(container.textContent).toContain('10,000,000')
    expect(container.textContent).toContain('5.00%')
  })

  test('renders labelSuffix node inline', () => {
    const fields: FieldDef[] = [
      {
        label: 'Currency',
        labelSuffix: <span data-testid="suffix">*</span>,
        value: 'USD',
        editable: false,
      },
    ]
    const { container } = render(<FieldGrid fields={fields} />)
    expect(container.querySelector('[data-testid="suffix"]')).not.toBeNull()
  })

  test('applies color decoration when color provided', () => {
    const fields: FieldDef[] = [{ label: 'PV', value: '123', editable: false, color: '#22c55e' }]
    const { container } = render(<FieldGrid fields={fields} />)
    const span = container.querySelector('span[style*="color"]')
    expect(span).not.toBeNull()
    expect((span as HTMLElement).getAttribute('style')).toMatch(/rgb\(34, ?197, ?94\)|#22c55e/)
  })
})

describe('FieldGrid — select field', () => {
  test('editable select renders options and fires onChange', () => {
    const onChange = vi.fn()
    const fields: FieldDef[] = [
      {
        label: 'DayCount',
        value: 'ACT_360',
        editable: true,
        type: 'select',
        options: [
          { label: 'ACT/360', value: 'ACT_360' },
          { label: 'ACT/365', value: 'ACT_365' },
        ],
        onChange,
      },
    ]
    const { container } = render(<FieldGrid fields={fields} />)
    const select = container.querySelector('select') as HTMLSelectElement
    expect(select).not.toBeNull()
    expect(select.value).toBe('ACT_360')
    fireEvent.change(select, { target: { value: 'ACT_365' } })
    expect(onChange).toHaveBeenCalledWith('ACT_365')
  })
})

describe('FieldGrid — editable text field', () => {
  test('click enters edit mode, blur-sm commits', () => {
    const onChange = vi.fn()
    const fields: FieldDef[] = [
      { label: 'Name', value: 'Alpha', editable: true, type: 'text', onChange },
    ]
    const { container } = render(<FieldGrid fields={fields} />)
    // value span — click to enter edit mode
    const valueSpan = container.querySelectorAll('span.cursor-pointer')[0] as HTMLElement
    fireEvent.click(valueSpan)
    const input = container.querySelector('input') as HTMLInputElement
    expect(input).not.toBeNull()
    fireEvent.change(input, { target: { value: 'Beta' } })
    fireEvent.blur(input)
    expect(onChange).toHaveBeenCalledWith('Beta')
  })

  test('Enter key commits, Escape resets', () => {
    const onChange = vi.fn()
    const fields: FieldDef[] = [
      { label: 'Name', value: 'Alpha', editable: true, type: 'text', onChange },
    ]
    const { container } = render(<FieldGrid fields={fields} />)
    fireEvent.click(container.querySelector('span.cursor-pointer') as HTMLElement)
    const input = container.querySelector('input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Beta' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('Beta')
    onChange.mockReset()

    // re-enter and escape — should not call onChange
    fireEvent.click(container.querySelector('span.cursor-pointer') as HTMLElement)
    const input2 = container.querySelector('input') as HTMLInputElement
    fireEvent.change(input2, { target: { value: 'Gamma' } })
    fireEvent.keyDown(input2, { key: 'Escape' })
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('FieldGrid — editable number field', () => {
  test('rejects non-numeric input chars, accepts valid numbers', () => {
    const onChange = vi.fn()
    const fields: FieldDef[] = [
      { label: 'Qty', value: 100, editable: true, type: 'number', onChange },
    ]
    const { container } = render(<FieldGrid fields={fields} />)
    fireEvent.click(container.querySelector('span.cursor-pointer') as HTMLElement)
    const input = container.querySelector('input') as HTMLInputElement
    // Non-numeric input is swallowed — value stays the same.
    fireEvent.change(input, { target: { value: 'abc' } })
    expect(input.value).not.toBe('abc')

    fireEvent.change(input, { target: { value: '250.5' } })
    expect(input.value).toBe('250.5')
    fireEvent.blur(input)
    expect(onChange).toHaveBeenCalledWith('250.5')
  })

  test('step buttons increment/decrement via onChange', () => {
    const onChange = vi.fn()
    const fields: FieldDef[] = [
      { label: 'Rate', value: 5, editable: true, type: 'number', step: 0.25, onChange },
    ]
    const { container } = render(<FieldGrid fields={fields} />)
    const stepButtons = container.querySelectorAll('button')
    expect(stepButtons.length).toBeGreaterThanOrEqual(2)
    fireEvent.click(stepButtons[0]) // ▲
    expect(onChange).toHaveBeenCalledWith('5.25')
    onChange.mockReset()
    fireEvent.click(stepButtons[1]) // ▼
    expect(onChange).toHaveBeenCalledWith('4.75')
  })

  test('unit badge shown in edit mode', () => {
    const fields: FieldDef[] = [
      { label: 'Rate', value: 5, editable: true, type: 'number', unit: 'bp', onChange: () => {} },
    ]
    const { container } = render(<FieldGrid fields={fields} />)
    fireEvent.click(container.querySelector('span.cursor-pointer') as HTMLElement)
    expect(container.textContent).toContain('bp')
  })
})

describe('FieldGrid — view (non-editable)', () => {
  test('non-editable field does not enter edit on click', () => {
    const onChange = vi.fn()
    const fields: FieldDef[] = [
      { label: 'Name', value: 'Alpha', editable: false, type: 'text', onChange },
    ]
    const { container } = render(<FieldGrid fields={fields} />)
    // no cursor-pointer span because editable=false
    expect(container.querySelector('span.cursor-pointer')).toBeNull()
    // no input rendered
    expect(container.querySelector('input')).toBeNull()
  })
})
