import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LedgerFilterBar } from '../ledger-filter-bar'

describe('LedgerFilterBar', () => {
  it('toggles a kind filter (removes clicked kind when currently selected)', () => {
    const onChange = vi.fn()
    render(
      <LedgerFilterBar value={{ kinds: ['create', 'exercise', 'archive'] }} onChange={onChange} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /archive/i }))
    expect(onChange).toHaveBeenCalledWith({ kinds: ['create', 'exercise'] })
  })

  it('toggles a kind filter back on when currently unselected', () => {
    const onChange = vi.fn()
    render(<LedgerFilterBar value={{ kinds: ['create'] }} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /archive/i }))
    expect(onChange).toHaveBeenCalledWith({ kinds: expect.arrayContaining(['create', 'archive']) })
  })

  it('emits a cidPrefix on text input', () => {
    const onChange = vi.fn()
    render(<LedgerFilterBar value={{ kinds: ['create'] }} onChange={onChange} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '00abc' } })
    expect(onChange).toHaveBeenLastCalledWith({ kinds: ['create'], cidPrefix: '00abc' })
  })

  it('clears cidPrefix when input is empty', () => {
    const onChange = vi.fn()
    render(<LedgerFilterBar value={{ kinds: ['create'], cidPrefix: 'aa' }} onChange={onChange} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '' } })
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0]
    expect(lastCall.cidPrefix).toBeUndefined()
  })
})
