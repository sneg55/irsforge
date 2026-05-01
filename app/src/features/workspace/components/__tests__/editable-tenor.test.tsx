import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { EditableTenor } from '../editable-tenor'

afterEach(() => cleanup())

describe('EditableTenor — view mode', () => {
  test('renders formatted tenor value', () => {
    const { container } = render(
      <EditableTenor value={{ years: 5, months: 0 }} onChange={() => {}} isEditable={false} />,
    )
    expect(container.textContent).toContain('Tenor')
    expect(container.textContent).toContain('5Y')
  })

  test('18-month tenor formats as 1Y6M', () => {
    const { container } = render(
      <EditableTenor value={{ years: 1, months: 6 }} onChange={() => {}} isEditable={false} />,
    )
    expect(container.textContent).toContain('1Y6M')
  })

  test('months-only tenor formats as "6M"', () => {
    const { container } = render(
      <EditableTenor value={{ years: 0, months: 6 }} onChange={() => {}} isEditable={false} />,
    )
    expect(container.textContent).toContain('6M')
  })

  test('non-editable click does not open input', () => {
    const { container } = render(
      <EditableTenor value={{ years: 5, months: 0 }} onChange={() => {}} isEditable={false} />,
    )
    fireEvent.click(container.firstChild as HTMLElement)
    expect(container.querySelector('input')).toBeNull()
  })
})

describe('EditableTenor — edit mode', () => {
  test('click enters edit mode showing an input prefilled with current tenor', () => {
    const { container } = render(
      <EditableTenor value={{ years: 5, months: 0 }} onChange={() => {}} isEditable />,
    )
    fireEvent.click(container.firstChild as HTMLElement)
    const input = container.querySelector('input') as HTMLInputElement
    expect(input).not.toBeNull()
    expect(input.value).toBe('5Y')
  })

  test('typing new value + Enter commits parsed tenor', () => {
    const onChange = vi.fn()
    const { container } = render(
      <EditableTenor value={{ years: 5, months: 0 }} onChange={onChange} isEditable />,
    )
    fireEvent.click(container.firstChild as HTMLElement)
    const input = container.querySelector('input') as HTMLInputElement
    fireEvent.change(input, { target: { value: '10Y' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith({ years: 10, months: 0 })
  })

  test('invalid input does not fire onChange and resets value', () => {
    const onChange = vi.fn()
    const { container } = render(
      <EditableTenor value={{ years: 5, months: 0 }} onChange={onChange} isEditable />,
    )
    fireEvent.click(container.firstChild as HTMLElement)
    const input = container.querySelector('input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'not-a-tenor' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).not.toHaveBeenCalled()
  })

  test('Escape exits without committing', () => {
    const onChange = vi.fn()
    const { container } = render(
      <EditableTenor value={{ years: 5, months: 0 }} onChange={onChange} isEditable />,
    )
    fireEvent.click(container.firstChild as HTMLElement)
    const input = container.querySelector('input') as HTMLInputElement
    fireEvent.change(input, { target: { value: '7Y' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onChange).not.toHaveBeenCalled()
    expect(container.querySelector('input')).toBeNull()
  })

  test('preset chip click commits that tenor', () => {
    const onChange = vi.fn()
    const { container } = render(
      <EditableTenor value={{ years: 5, months: 0 }} onChange={onChange} isEditable />,
    )
    fireEvent.click(container.firstChild as HTMLElement)
    const chipButtons = Array.from(container.querySelectorAll('button'))
    const tenYear = chipButtons.find((b) => b.textContent === '10Y')!
    fireEvent.mouseDown(tenYear)
    expect(onChange).toHaveBeenCalledWith({ years: 10, months: 0 })
  })

  test('18M preset parses correctly', () => {
    const onChange = vi.fn()
    const { container } = render(
      <EditableTenor
        value={{ years: 1, months: 0 }}
        onChange={onChange}
        isEditable
        presets={['18M', '5Y']}
      />,
    )
    fireEvent.click(container.firstChild as HTMLElement)
    const chip = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === '18M',
    )!
    fireEvent.mouseDown(chip)
    expect(onChange).toHaveBeenCalledWith({ years: 0, months: 18 })
  })
})
