import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
import type { MarkViewModel } from '../../decode'
import { MarkSparkline } from '../mark-sparkline'

afterEach(() => cleanup())

function mk(e: number, i: number): MarkViewModel {
  return {
    contractId: `c${i}`,
    csaCid: 'cs',
    partyA: 'A',
    partyB: 'B',
    asOf: `2026-04-0${i}`,
    exposure: e,
    snapshot: '{}',
  }
}

describe('MarkSparkline', () => {
  test('returns placeholder when history has <2 entries', () => {
    const { container } = render(<MarkSparkline history={[]} />)
    expect(container.textContent).toContain('no marks yet')
  })

  test('renders polyline for ≥2 entries with positive last exposure (red)', () => {
    const history = [mk(-100, 1), mk(200, 2), mk(500, 3)]
    const { container } = render(<MarkSparkline history={history} />)
    const poly = container.querySelector('polyline')
    expect(poly).toBeTruthy()
    expect(poly!.getAttribute('stroke')).toBe('#ef4444')
  })

  test('last exposure ≤ 0 renders green polyline and respects width/height props', () => {
    const history = [mk(500, 1), mk(-50, 2)]
    const { container } = render(<MarkSparkline history={history} width={200} height={40} />)
    const svg = container.querySelector('svg')
    expect(svg!.getAttribute('width')).toBe('200')
    expect(svg!.getAttribute('height')).toBe('40')
    expect(container.querySelector('polyline')!.getAttribute('stroke')).toBe('#22c55e')
  })
})
