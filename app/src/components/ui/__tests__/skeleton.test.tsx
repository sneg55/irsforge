import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
import { Skeleton } from '../skeleton'

afterEach(() => cleanup())

describe('Skeleton', () => {
  test('renders a div with animate-pulse and default background', () => {
    const { container } = render(<Skeleton />)
    const el = container.firstChild as HTMLElement
    expect(el.tagName).toBe('DIV')
    expect(el.className.includes('animate-pulse')).toBe(true)
    expect(el.className.includes('bg-zinc-800/60')).toBe(true)
    expect(el.className.includes('rounded-md')).toBe(true)
  })

  test('merges caller classNames', () => {
    const { container } = render(<Skeleton className="h-8 w-32" />)
    const el = container.firstChild as HTMLElement
    expect(el.className.includes('h-8')).toBe(true)
    expect(el.className.includes('w-32')).toBe(true)
    expect(el.className.includes('animate-pulse')).toBe(true)
  })

  test('passes through standard div props', () => {
    const { container } = render(<Skeleton aria-label="loading" data-testid="sk" />)
    const el = container.firstChild as HTMLElement
    expect(el.getAttribute('aria-label')).toBe('loading')
    expect(el.getAttribute('data-testid')).toBe('sk')
  })
})
