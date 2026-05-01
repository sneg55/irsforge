import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
import { Sparkline } from '../sparkline'

afterEach(() => cleanup())

describe('Sparkline', () => {
  test('renders dotted placeholder for empty series', () => {
    const { container } = render(<Sparkline values={[]} />)
    expect(container.querySelector('line')).not.toBeNull()
    expect(container.querySelector('polyline')).toBeNull()
  })

  test('renders a centered dot for a single-point series', () => {
    const { container } = render(
      <Sparkline values={[42]} width={80} height={16} stroke="#4ade80" />,
    )
    const circle = container.querySelector('circle')
    expect(circle).not.toBeNull()
    expect(circle!.getAttribute('cx')).toBe('40')
    expect(circle!.getAttribute('cy')).toBe('8')
    expect(circle!.getAttribute('fill')).toBe('#4ade80')
    expect(container.querySelector('polyline')).toBeNull()
  })

  test('renders a polyline with N points for N values', () => {
    const { container } = render(<Sparkline values={[1, 2, 3, 4]} width={100} height={20} />)
    const poly = container.querySelector('polyline')
    expect(poly).not.toBeNull()
    const points = poly!.getAttribute('points')!.trim().split(' ')
    expect(points).toHaveLength(4)
  })

  test('draws zero band when series straddles zero and zeroBand=true', () => {
    const { container } = render(<Sparkline values={[-1, 0, 1]} />)
    // zero band line + polyline
    const lines = container.querySelectorAll('line')
    expect(lines.length).toBe(1)
  })

  test('hides zero band when series stays positive', () => {
    const { container } = render(<Sparkline values={[1, 2, 3]} />)
    const lines = container.querySelectorAll('line')
    expect(lines.length).toBe(0)
  })

  test('respects custom stroke color', () => {
    const { container } = render(<Sparkline values={[1, 2]} stroke="#ef4444" />)
    expect(container.querySelector('polyline')!.getAttribute('stroke')).toBe('#ef4444')
  })
})
