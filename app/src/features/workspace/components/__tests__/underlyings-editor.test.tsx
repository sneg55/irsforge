import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { UnderlyingsEditor } from '../underlyings-editor'

afterEach(() => cleanup())

const u1 = { assetId: 'AAPL', weight: 0.6, initialPrice: 180, currentPrice: 195 }
const u2 = { assetId: 'MSFT', weight: 0.4, initialPrice: 350, currentPrice: 400 }

describe('UnderlyingsEditor — render', () => {
  test('renders one row per underlying with asset id + weight + price', () => {
    const { container } = render(
      <UnderlyingsEditor underlyings={[u1, u2]} editable={false} onChange={() => {}} />,
    )
    expect(container.textContent).toContain('AAPL')
    expect(container.textContent).toContain('MSFT')
    expect(container.textContent).toContain('60%')
    expect(container.textContent).toContain('40%')
    expect(container.textContent).toContain('180')
  })

  test('weight warning shown when weights do not sum to 100%', () => {
    const bad = [
      { ...u1, weight: 0.5 },
      { ...u2, weight: 0.3 },
    ]
    const { container } = render(
      <UnderlyingsEditor underlyings={bad} editable={false} onChange={() => {}} />,
    )
    expect(container.textContent).toContain('Weights sum to 80%')
  })

  test('editable=false hides Add / Remove controls', () => {
    const { container } = render(
      <UnderlyingsEditor underlyings={[u1, u2]} editable={false} onChange={() => {}} />,
    )
    expect(container.textContent).not.toContain('Add Underlying')
    expect(container.querySelectorAll('button').length).toBe(0)
  })
})

describe('UnderlyingsEditor — edit', () => {
  test('Add Underlying button appends a default row', () => {
    const onChange = vi.fn()
    const { container } = render(
      <UnderlyingsEditor underlyings={[u1]} editable onChange={onChange} />,
    )
    const addBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').includes('Add Underlying'),
    )!
    fireEvent.click(addBtn)
    expect(onChange).toHaveBeenCalledTimes(1)
    const next = onChange.mock.calls[0][0]
    expect(next).toHaveLength(2)
    expect(next[1].assetId).toBe('')
    expect(next[1].weight).toBe(1.0)
  })

  test('remove button on row (when count > 1) drops that row', () => {
    const onChange = vi.fn()
    const { container } = render(
      <UnderlyingsEditor underlyings={[u1, u2]} editable onChange={onChange} />,
    )
    const removeBtns = Array.from(container.querySelectorAll('button')).filter((b) =>
      (b.textContent ?? '').includes('×'),
    )
    expect(removeBtns.length).toBe(2)
    fireEvent.click(removeBtns[0])
    expect(onChange).toHaveBeenCalledWith([u2])
  })

  test('remove button hidden when only one row remains', () => {
    const { container } = render(
      <UnderlyingsEditor underlyings={[u1]} editable onChange={() => {}} />,
    )
    const removeBtns = Array.from(container.querySelectorAll('button')).filter((b) =>
      (b.textContent ?? '').includes('×'),
    )
    expect(removeBtns.length).toBe(0)
  })

  test('editing assetId commits new value on blur-sm', () => {
    const onChange = vi.fn()
    const { container } = render(
      <UnderlyingsEditor underlyings={[u1]} editable onChange={onChange} />,
    )
    // click the assetId cell to enter edit mode
    const cells = container.querySelectorAll('tbody td')
    fireEvent.click(cells[0])
    const input = container.querySelector('input') as HTMLInputElement
    expect(input).not.toBeNull()
    expect(input.defaultValue).toBe('AAPL')
    fireEvent.blur(input, { target: { value: 'GOOG' } })
    expect(onChange).toHaveBeenCalled()
    const patched = onChange.mock.calls[0][0]
    expect(patched[0].assetId).toBe('GOOG')
  })

  test('editing weight parses percentage input back into fraction', () => {
    const onChange = vi.fn()
    const { container } = render(
      <UnderlyingsEditor underlyings={[u1]} editable onChange={onChange} />,
    )
    const cells = container.querySelectorAll('tbody td')
    // second cell is weight
    fireEvent.click(cells[1])
    const input = container.querySelector('input') as HTMLInputElement
    fireEvent.keyDown(input, { key: 'Enter', target: { value: '75' } })
    // fallback since keyDown target.value may not bind: use blur path
    fireEvent.blur(input, { target: { value: '75' } })
    const patched = onChange.mock.calls[onChange.mock.calls.length - 1][0]
    expect(patched[0].weight).toBeCloseTo(0.75, 5)
  })

  test('editing initialPrice syncs currentPrice to the new value', () => {
    const onChange = vi.fn()
    const { container } = render(
      <UnderlyingsEditor underlyings={[u1]} editable onChange={onChange} />,
    )
    const cells = container.querySelectorAll('tbody td')
    fireEvent.click(cells[2]) // initialPrice cell
    const input = container.querySelector('input') as HTMLInputElement
    fireEvent.blur(input, { target: { value: '210' } })
    const patched = onChange.mock.calls[0][0]
    expect(patched[0].initialPrice).toBe(210)
    expect(patched[0].currentPrice).toBe(210)
  })
})
