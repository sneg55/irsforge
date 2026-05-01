import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'

afterEach(cleanup)

import { PartyDirectoryProvider } from '../src/react'
import { PartyName } from '../src/ui'

const FULL_ID = 'PartyA::122020ad6b890abe445eadfb9cdaec3dfa784e8c'

function Wrapper({ children }: { children: React.ReactNode }) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ result: [], status: 200 }),
    }),
  )

  return (
    <PartyDirectoryProvider
      entries={[{ identifier: FULL_ID, displayName: 'Goldman Sachs', hint: 'PartyA' }]}
    >
      {children}
    </PartyDirectoryProvider>
  )
}

describe('PartyName', () => {
  test('renders display name for known party', () => {
    render(<PartyName identifier={FULL_ID} />, { wrapper: Wrapper })
    expect(screen.getByText('Goldman Sachs')).toBeDefined()
  })

  test('variant="full" shows name with hint', () => {
    render(<PartyName identifier={FULL_ID} variant="full" />, { wrapper: Wrapper })
    expect(screen.getByText(/Goldman Sachs/)).toBeDefined()
    expect(screen.getByText(/PartyA/)).toBeDefined()
  })

  test('variant="badge" shows initials', () => {
    render(<PartyName identifier={FULL_ID} variant="badge" />, { wrapper: Wrapper })
    expect(screen.getByText('GS')).toBeDefined()
    expect(screen.getByText('Goldman Sachs')).toBeDefined()
  })

  test('renders hint for unknown party with :: identifier', () => {
    render(<PartyName identifier="PartyC::abcdef" />, { wrapper: Wrapper })
    expect(screen.getByText('PartyC')).toBeDefined()
  })

  test('renders truncated hash for fully unknown identifier', () => {
    render(<PartyName identifier="abcdef1234567890abcdef" />, { wrapper: Wrapper })
    expect(screen.getByText('abcdef1234...')).toBeDefined()
  })

  test('copies identifier to clipboard on click', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    render(<PartyName identifier={FULL_ID} />, { wrapper: Wrapper })
    fireEvent.click(screen.getByText('Goldman Sachs'))

    expect(writeText).toHaveBeenCalledWith(FULL_ID)
  })

  test('does not copy when copyable=false', () => {
    const writeText = vi.fn()
    Object.assign(navigator, { clipboard: { writeText } })

    render(<PartyName identifier={FULL_ID} copyable={false} />, { wrapper: Wrapper })
    fireEvent.click(screen.getByText('Goldman Sachs'))

    expect(writeText).not.toHaveBeenCalled()
  })

  test('passes className through', () => {
    render(<PartyName identifier={FULL_ID} className="custom-class" />, { wrapper: Wrapper })
    const el = screen.getByText('Goldman Sachs').closest('span')
    expect(el?.className).toContain('custom-class')
  })
})
