import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { CsaAmountModal } from '../csa-amount-modal'

afterEach(() => cleanup())

describe('CsaAmountModal — visibility', () => {
  test('renders nothing when isOpen=false', () => {
    const { container } = render(
      <CsaAmountModal
        isOpen={false}
        mode="post"
        ccy="USD"
        onClose={() => {}}
        onSubmit={async () => {}}
      />,
    )
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  test('renders POST COLLATERAL title in post mode', () => {
    const { container } = render(
      <CsaAmountModal isOpen mode="post" ccy="USD" onClose={() => {}} onSubmit={async () => {}} />,
    )
    expect(container.textContent).toContain('POST COLLATERAL')
    expect(container.textContent).toContain('Amount (USD)')
  })

  test('renders WITHDRAW title + posted balance hint in withdraw mode', () => {
    const { container } = render(
      <CsaAmountModal
        isOpen
        mode="withdraw"
        ccy="EUR"
        max={500_000}
        onClose={() => {}}
        onSubmit={async () => {}}
      />,
    )
    expect(container.textContent).toContain('WITHDRAW COLLATERAL')
    expect(container.textContent).toContain('Posted balance')
    expect(container.textContent).toMatch(/\$500,000/)
  })
})

describe('CsaAmountModal — submit + validation', () => {
  test('positive amount fires onSubmit then onClose', async () => {
    const onSubmit = vi.fn(async () => {})
    const onClose = vi.fn()
    const { container } = render(
      <CsaAmountModal isOpen mode="post" ccy="USD" onClose={onClose} onSubmit={onSubmit} />,
    )
    const input = container.querySelector('input') as HTMLInputElement
    fireEvent.change(input, { target: { value: '250000' } })
    const postBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Post',
    )!
    await act(async () => {
      fireEvent.click(postBtn)
    })
    expect(onSubmit).toHaveBeenCalledWith(250_000)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test('non-positive amount shows error and does not submit', async () => {
    const onSubmit = vi.fn(async () => {})
    const { container } = render(
      <CsaAmountModal isOpen mode="post" ccy="USD" onClose={() => {}} onSubmit={onSubmit} />,
    )
    const input = container.querySelector('input') as HTMLInputElement
    fireEvent.change(input, { target: { value: '-50' } })
    await act(async () => {
      fireEvent.click(
        Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Post')!,
      )
    })
    expect(onSubmit).not.toHaveBeenCalled()
    expect(container.textContent).toContain('must be a positive number')
  })

  test('withdraw > max shows error', async () => {
    const onSubmit = vi.fn(async () => {})
    const { container } = render(
      <CsaAmountModal
        isOpen
        mode="withdraw"
        ccy="USD"
        max={1000}
        onClose={() => {}}
        onSubmit={onSubmit}
      />,
    )
    const input = container.querySelector('input') as HTMLInputElement
    fireEvent.change(input, { target: { value: '5000' } })
    await act(async () => {
      fireEvent.click(
        Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Withdraw')!,
      )
    })
    expect(onSubmit).not.toHaveBeenCalled()
    expect(container.textContent).toMatch(/above posted balance/i)
  })

  test('Max button in withdraw mode populates the amount input', () => {
    const { container } = render(
      <CsaAmountModal
        isOpen
        mode="withdraw"
        ccy="USD"
        max={1234}
        onClose={() => {}}
        onSubmit={async () => {}}
      />,
    )
    const maxBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Max',
    )!
    fireEvent.click(maxBtn)
    const input = container.querySelector('input') as HTMLInputElement
    expect(input.value).toBe('1234')
  })

  test('Cancel fires onClose', () => {
    const onClose = vi.fn()
    const { container } = render(
      <CsaAmountModal isOpen mode="post" ccy="USD" onClose={onClose} onSubmit={async () => {}} />,
    )
    fireEvent.click(
      Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Cancel')!,
    )
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  test('Enter key submits', async () => {
    const onSubmit = vi.fn(async () => {})
    const { container } = render(
      <CsaAmountModal isOpen mode="post" ccy="USD" onClose={() => {}} onSubmit={onSubmit} />,
    )
    const input = container.querySelector('input') as HTMLInputElement
    fireEvent.change(input, { target: { value: '500' } })
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })
    expect(onSubmit).toHaveBeenCalledWith(500)
  })

  test('onSubmit throwing surfaces the error message', async () => {
    const onSubmit = vi.fn(async () => {
      throw new Error('boom')
    })
    const { container } = render(
      <CsaAmountModal isOpen mode="post" ccy="USD" onClose={() => {}} onSubmit={onSubmit} />,
    )
    const input = container.querySelector('input') as HTMLInputElement
    fireEvent.change(input, { target: { value: '100' } })
    await act(async () => {
      fireEvent.click(
        Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Post')!,
      )
    })
    expect(container.textContent).toContain('boom')
  })
})
