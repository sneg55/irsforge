import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { EditableDate } from '../editable-date'

afterEach(() => cleanup())

function getInput(container: HTMLElement): HTMLInputElement {
  return container.querySelector('input[type="text"]') as HTMLInputElement
}

describe('EditableDate', () => {
  test('click + Enter commits a parsed date via onChange', () => {
    const onChange = vi.fn()
    const { container } = render(
      <EditableDate label="Trade" value={new Date('2026-04-14')} onChange={onChange} isEditable />,
    )
    fireEvent.click(container.querySelector('div')!)
    const input = getInput(container)
    fireEvent.change(input, { target: { value: '05/20/26' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledTimes(1)
    const committed = onChange.mock.calls[0][0] as Date
    expect(committed.getFullYear()).toBe(2026)
    expect(committed.getMonth()).toBe(4) // May
    expect(committed.getDate()).toBe(20)
  })

  test('Escape reverts to original and does not fire onChange', () => {
    const onChange = vi.fn()
    const { container } = render(
      <EditableDate label="Eff" value={new Date('2026-04-14')} onChange={onChange} isEditable />,
    )
    fireEvent.click(container.querySelector('div')!)
    const input = getInput(container)
    fireEvent.change(input, { target: { value: 'garbage' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onChange).not.toHaveBeenCalled()
    // After Escape, we exit editing mode and display the original value.
    expect(container.querySelector('input')).toBeNull()
  })

  test('invalid input does not fire onChange (stays in editing with flash)', () => {
    const onChange = vi.fn()
    const { container } = render(
      <EditableDate label="Mat" value={new Date('2026-04-14')} onChange={onChange} isEditable />,
    )
    fireEvent.click(container.querySelector('div')!)
    const input = getInput(container)
    fireEvent.change(input, { target: { value: 'not-a-date' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).not.toHaveBeenCalled()
  })

  test('blur-sm commits the current text', () => {
    const onChange = vi.fn()
    const { container } = render(
      <EditableDate label="Trade" value={new Date('2026-04-14')} onChange={onChange} isEditable />,
    )
    fireEvent.click(container.querySelector('div')!)
    const input = getInput(container)
    fireEvent.change(input, { target: { value: '06/15/26' } })
    fireEvent.blur(input)
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  test('view mode does not open an editor on click', () => {
    const onChange = vi.fn()
    const { container } = render(
      <EditableDate
        label="Trade"
        value={new Date('2026-04-14')}
        onChange={onChange}
        isEditable={false}
      />,
    )
    fireEvent.click(container.querySelector('div')!)
    expect(container.querySelector('input')).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
  })

  test('relative tenor (+1y) is parsed relative to current value', () => {
    const onChange = vi.fn()
    const { container } = render(
      <EditableDate label="Mat" value={new Date('2026-04-14')} onChange={onChange} isEditable />,
    )
    fireEvent.click(container.querySelector('div')!)
    const input = getInput(container)
    fireEvent.change(input, { target: { value: '+1y' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledTimes(1)
    const committed = onChange.mock.calls[0][0] as Date
    expect(committed.getFullYear()).toBe(2027)
  })
})
