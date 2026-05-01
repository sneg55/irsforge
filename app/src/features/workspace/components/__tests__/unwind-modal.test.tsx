import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { UnwindModal } from '../unwind-modal'

afterEach(() => cleanup())

describe('UnwindModal', () => {
  test('pre-fills PV from currentNpv', () => {
    render(
      <UnwindModal
        isOpen={true}
        onClose={() => {}}
        currentNpv={1234.56}
        onSubmit={async () => {}}
      />,
    )
    const pvInput = screen.getByLabelText(/pv amount/i) as HTMLInputElement
    expect(pvInput.value).toBe('1234.56')
  })

  test('shows validation error for non-numeric PV', async () => {
    render(
      <UnwindModal isOpen={true} onClose={() => {}} currentNpv={100} onSubmit={async () => {}} />,
    )
    const pvInput = screen.getByLabelText(/pv amount/i)
    fireEvent.change(pvInput, { target: { value: 'not-a-number' } })
    const reasonInput = screen.getByLabelText(/reason/i)
    fireEvent.change(reasonInput, { target: { value: 'ok' } })
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))
    await waitFor(() => {
      expect(screen.getByText(/must be a number/i)).toBeTruthy()
    })
  })

  test('shows validation error for empty reason', async () => {
    render(
      <UnwindModal isOpen={true} onClose={() => {}} currentNpv={100} onSubmit={async () => {}} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))
    await waitFor(() => {
      expect(screen.getByText(/reason is required/i)).toBeTruthy()
    })
  })

  test('calls onSubmit with parsed values on valid submit', async () => {
    const onSubmit = vi.fn(async () => {})
    render(<UnwindModal isOpen={true} onClose={() => {}} currentNpv={500} onSubmit={onSubmit} />)
    fireEvent.change(screen.getByLabelText(/pv amount/i), { target: { value: '750.25' } })
    fireEvent.change(screen.getByLabelText(/reason/i), { target: { value: 'test unwind' } })
    fireEvent.click(screen.getByRole('button', { name: /submit/i }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(750.25, 'test unwind'))
  })
})
