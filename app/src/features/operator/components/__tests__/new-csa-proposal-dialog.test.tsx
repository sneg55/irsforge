import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockProposeCsa = vi.fn()

vi.mock('../../ledger/csa-proposal-actions', () => ({
  proposeCsa: (...args: unknown[]) => mockProposeCsa(...args),
}))

const mockClient = { resolvePartyId: vi.fn(), create: vi.fn() }

vi.mock('@/shared/hooks/use-ledger-client', () => ({
  useLedgerClient: () => ({
    client: mockClient,
    activeParty: 'PartyA',
  }),
}))

// canton-party-directory's PartyName resolves identifiers via a context
// lookup. Tests don't need the directory; render the raw hint as text.
vi.mock('canton-party-directory/ui', () => ({
  PartyName: ({ identifier }: { identifier: string }) => <span>{identifier}</span>,
}))

vi.mock('@/shared/contexts/config-context', () => ({
  useConfig: () => ({
    config: {
      currencies: [
        { code: 'USD', label: 'US Dollar', isDefault: true },
        { code: 'EUR', label: 'Euro' },
      ],
      orgs: [
        { id: 'goldman', displayName: 'Goldman Sachs', hint: 'PartyA', role: 'trader' },
        { id: 'jpmorgan', displayName: 'JPMorgan', hint: 'PartyB', role: 'trader' },
        { id: 'operator', displayName: 'Operator', hint: 'Operator', role: 'operator' },
        { id: 'regulator', displayName: 'Regulator', hint: 'Regulator', role: 'regulator' },
      ],
    },
    loading: false,
    getOrg: () => undefined,
  }),
}))

import { NewCsaProposalDialog } from '../new-csa-proposal-dialog'

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: 0 } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

function fillValidForm(container: HTMLElement) {
  const counterpartyInput = container.querySelector(
    '[data-testid="counterparty-hint"]',
  ) as HTMLInputElement
  const dirAInput = container.querySelector('[data-testid="threshold-dir-a"]') as HTMLInputElement
  const dirBInput = container.querySelector('[data-testid="threshold-dir-b"]') as HTMLInputElement
  const mtaInput = container.querySelector('[data-testid="mta"]') as HTMLInputElement
  const roundingInput = container.querySelector('[data-testid="rounding"]') as HTMLInputElement
  const valuationInput = container.querySelector(
    '[data-testid="valuation-ccy"]',
  ) as HTMLInputElement
  const ccyInput = container.querySelector('[data-testid="eligible-ccy-0"]') as HTMLInputElement
  const haircutInput = container.querySelector(
    '[data-testid="eligible-haircut-0"]',
  ) as HTMLInputElement
  const isdaRefInput = container.querySelector('[data-testid="isda-ma-ref"]') as HTMLInputElement
  const govLawSelect = container.querySelector('[data-testid="governing-law"]') as HTMLSelectElement
  const imAmountInput = container.querySelector('[data-testid="im-amount"]') as HTMLInputElement

  fireEvent.change(counterpartyInput, { target: { value: 'PartyB' } })
  fireEvent.blur(counterpartyInput)
  fireEvent.change(dirAInput, { target: { value: '100000' } })
  fireEvent.change(dirBInput, { target: { value: '200000' } })
  fireEvent.change(mtaInput, { target: { value: '50000' } })
  fireEvent.change(roundingInput, { target: { value: '1000' } })
  fireEvent.change(valuationInput, { target: { value: 'USD' } })
  fireEvent.change(ccyInput, { target: { value: 'USD' } })
  fireEvent.change(haircutInput, { target: { value: '0.02' } })
  fireEvent.change(isdaRefInput, { target: { value: 'ISDA-2002-DEMO' } })
  fireEvent.change(govLawSelect, { target: { value: 'NewYork' } })
  fireEvent.change(imAmountInput, { target: { value: '0' } })
}

describe('NewCsaProposalDialog', () => {
  it('submit button is disabled until ISDA MA ref is filled', () => {
    // Counterparty + valuation CCY + eligible CCY all auto-fill from
    // useConfig(), and zero thresholds/MTA/rounding/IM are valid — but
    // isdaMasterAgreementRef has no default, so a freshly opened dialog
    // is NOT submittable until the user types a reference.
    const { container } = wrap(<NewCsaProposalDialog open onClose={vi.fn()} />)
    const submit = container.querySelector('[data-testid="submit-proposal"]') as HTMLButtonElement
    expect(submit.disabled).toBe(true)
    const isdaRefInput = container.querySelector('[data-testid="isda-ma-ref"]') as HTMLInputElement
    fireEvent.change(isdaRefInput, { target: { value: 'ISDA-2002-DEMO' } })
    expect(submit.disabled).toBe(false)
  })

  it('renders ISDA MA ref, governing law, and IM amount controls', () => {
    const { container } = wrap(<NewCsaProposalDialog open onClose={vi.fn()} />)
    expect(container.querySelector('[data-testid="isda-ma-ref"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="governing-law"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="im-amount"]')).not.toBeNull()
  })

  it('blocks submit when imAmount is negative', () => {
    const { container } = wrap(<NewCsaProposalDialog open onClose={vi.fn()} />)
    fillValidForm(container)
    const imInput = container.querySelector('[data-testid="im-amount"]') as HTMLInputElement
    fireEvent.change(imInput, { target: { value: '-1' } })
    fireEvent.blur(imInput)
    const submit = container.querySelector('[data-testid="submit-proposal"]') as HTMLButtonElement
    expect(submit.disabled).toBe(true)
    const error = container.querySelector('[data-testid="im-amount-error"]')
    expect(error).not.toBeNull()
  })

  it('submit button becomes enabled when all fields are valid', () => {
    const { container } = wrap(<NewCsaProposalDialog open onClose={vi.fn()} />)
    fillValidForm(container)
    const submit = container.querySelector('[data-testid="submit-proposal"]') as HTMLButtonElement
    expect(submit.disabled).toBe(false)
  })

  it('calls proposeCsa with correctly shaped args on submit', async () => {
    mockProposeCsa.mockResolvedValue({ contractId: 'new-cid' })
    const onClose = vi.fn()
    const { container } = wrap(<NewCsaProposalDialog open onClose={onClose} />)
    fillValidForm(container)

    const submit = container.querySelector('[data-testid="submit-proposal"]') as HTMLButtonElement
    fireEvent.click(submit)

    await new Promise((r) => setTimeout(r, 0))

    expect(mockProposeCsa).toHaveBeenCalledWith(mockClient, {
      proposerHint: 'PartyA',
      counterpartyHint: 'PartyB',
      thresholdDirA: 100000,
      thresholdDirB: 200000,
      mta: 50000,
      rounding: 1000,
      eligible: [{ currency: 'USD', haircut: '0.02' }],
      valuationCcy: 'USD',
      isdaMasterAgreementRef: 'ISDA-2002-DEMO',
      governingLaw: 'NewYork',
      imAmount: 0,
    })
  })

  it('shows inline error when mta is negative after blur-sm', () => {
    const { container } = wrap(<NewCsaProposalDialog open onClose={vi.fn()} />)
    const mtaInput = container.querySelector('[data-testid="mta"]') as HTMLInputElement
    fireEvent.change(mtaInput, { target: { value: '-1' } })
    fireEvent.blur(mtaInput)
    const error = container.querySelector('[data-testid="mta-error"]')
    expect(error).not.toBeNull()
    expect(error?.textContent).toContain('≥ 0')
  })

  it('counterparty dropdown excludes the active party and system roles', () => {
    // The "no self-CSA" guard in validateForm is now structurally enforced
    // by the dropdown — PartyA (the active party), Operator and Regulator
    // never appear as options, so the user cannot pick them.
    const { container } = wrap(<NewCsaProposalDialog open onClose={vi.fn()} />)
    const select = container.querySelector('[data-testid="counterparty-hint"]') as HTMLSelectElement
    const optionValues = Array.from(select.options).map((o) => o.value)
    expect(optionValues).toEqual(['PartyB'])
  })

  it('closes and resets after successful submit', async () => {
    mockProposeCsa.mockResolvedValue({ contractId: 'new-cid' })
    const onClose = vi.fn()
    const { container } = wrap(<NewCsaProposalDialog open onClose={onClose} />)
    fillValidForm(container)

    const submit = container.querySelector('[data-testid="submit-proposal"]') as HTMLButtonElement
    fireEvent.click(submit)

    await new Promise((r) => setTimeout(r, 10))
    expect(onClose).toHaveBeenCalled()
  })
})

describe('NewCsaProposalDialog with YAML-pinned ISDA Master Agreement', () => {
  // When the active party + selected counterparty pair has a registered MA in
  // YAML config, the dialog renders read-only pinned metadata instead of free
  // text inputs. This guards against fat-fingered MA references and locks the
  // governing-law selection to whatever the MA actually specifies.
  beforeEach(() => {
    vi.resetModules()
  })

  it('renders pinned MA + locked governing law, hides free-text inputs, allows submit without typing', async () => {
    vi.doMock('@/shared/contexts/config-context', () => ({
      useConfig: () => ({
        config: {
          currencies: [{ code: 'USD', label: 'US Dollar', isDefault: true }],
          orgs: [
            { id: 'goldman', displayName: 'Goldman Sachs', hint: 'PartyA', role: 'trader' },
            { id: 'jpmorgan', displayName: 'JPMorgan', hint: 'PartyB', role: 'trader' },
          ],
          masterAgreements: [
            {
              parties: ['PartyA', 'PartyB'],
              reference: 'ISDA-2002-Goldman-JPMorgan-2014-03-12',
              governingLaw: 'English',
            },
          ],
        },
        loading: false,
        getOrg: () => undefined,
      }),
    }))

    const { NewCsaProposalDialog: PinnedDialog } = await import('../new-csa-proposal-dialog')
    const { container } = wrap(<PinnedDialog open onClose={vi.fn()} />)

    expect(container.querySelector('[data-testid="isda-ma-pinned"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="isda-ma-pinned"]')?.textContent).toContain(
      'ISDA-2002-Goldman-JPMorgan-2014-03-12',
    )
    expect(container.querySelector('[data-testid="isda-ma-pinned"]')?.textContent).toContain(
      'English',
    )
    expect(container.querySelector('[data-testid="isda-ma-ref"]')).toBeNull()
    expect(container.querySelector('[data-testid="governing-law"]')).toBeNull()

    const submit = container.querySelector('[data-testid="submit-proposal"]') as HTMLButtonElement
    expect(submit.disabled).toBe(false)
  })

  it('falls back to free-text when the pair is not registered', async () => {
    vi.doMock('@/shared/contexts/config-context', () => ({
      useConfig: () => ({
        config: {
          currencies: [{ code: 'USD', label: 'US Dollar', isDefault: true }],
          orgs: [
            { id: 'goldman', displayName: 'Goldman Sachs', hint: 'PartyA', role: 'trader' },
            { id: 'jpmorgan', displayName: 'JPMorgan', hint: 'PartyB', role: 'trader' },
          ],
          masterAgreements: [
            {
              parties: ['PartyA', 'PartyC'],
              reference: 'ISDA-2002-Goldman-Citi-2018-06-01',
              governingLaw: 'English',
            },
          ],
        },
        loading: false,
        getOrg: () => undefined,
      }),
    }))

    const { NewCsaProposalDialog: FallbackDialog } = await import('../new-csa-proposal-dialog')
    const { container } = wrap(<FallbackDialog open onClose={vi.fn()} />)

    expect(container.querySelector('[data-testid="isda-ma-pinned"]')).toBeNull()
    expect(container.querySelector('[data-testid="isda-ma-ref"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="governing-law"]')).not.toBeNull()
  })
})
