import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
import { LivenessDot } from '../liveness-dot'

afterEach(() => cleanup())

describe('LivenessDot', () => {
  test('renders green + pulsing for "live"', () => {
    const { container } = render(<LivenessDot state="live" />)
    const el = container.querySelector('[data-slot="liveness-dot"]') as HTMLElement
    expect(el.className.includes('bg-green-500')).toBe(true)
    expect(el.className.includes('animate-pulse')).toBe(true)
  })

  test('renders amber + pulsing for "stale"', () => {
    const { container } = render(<LivenessDot state="stale" />)
    const el = container.querySelector('[data-slot="liveness-dot"]') as HTMLElement
    expect(el.className.includes('bg-amber-500')).toBe(true)
    expect(el.className.includes('animate-pulse')).toBe(true)
  })

  test('renders red + solid for "disconnected"', () => {
    const { container } = render(<LivenessDot state="disconnected" />)
    const el = container.querySelector('[data-slot="liveness-dot"]') as HTMLElement
    expect(el.className.includes('bg-red-500')).toBe(true)
    expect(el.className.includes('animate-pulse')).toBe(false)
  })

  test('renders zinc + solid for "idle"', () => {
    const { container } = render(<LivenessDot state="idle" />)
    const el = container.querySelector('[data-slot="liveness-dot"]') as HTMLElement
    expect(el.className.includes('bg-zinc-600')).toBe(true)
    expect(el.className.includes('animate-pulse')).toBe(false)
  })

  test('passes title attribute for a11y tooltip', () => {
    const { container } = render(<LivenessDot state="live" title="Feed is live" />)
    const el = container.querySelector('[data-slot="liveness-dot"]') as HTMLElement
    expect(el.getAttribute('title')).toBe('Feed is live')
  })
})
