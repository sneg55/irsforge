import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  IrsInstrumentPayload,
  SwapInstrumentPayload,
} from '@/shared/ledger/swap-instrument-types'
import { ExportFpmlButton } from '../export-button'

afterEach(() => cleanup())

const mkIrsInstrument = (): SwapInstrumentPayload => ({
  swapType: 'IRS',
  payload: {
    depository: 'op::1',
    issuer: 'op::1',
    id: { unpack: 'IRS-INST-1' },
    version: '1',
    holdingStandard: 'TransferableFungible',
    description: 'IRS',
    floatingRate: { referenceRateId: 'USD-SOFR' },
    ownerReceivesFix: true,
    fixRate: '0.0425',
    periodicSchedule: {
      effectiveDate: '2026-04-16',
      terminationDate: '2031-04-16',
      firstRegularPeriodStartDate: null,
      lastRegularPeriodEndDate: null,
    },
    dayCountConvention: 'Act360',
    currency: {
      depository: 'op::1',
      issuer: 'op::1',
      id: { unpack: 'USD' },
      version: '1',
      holdingStandard: 'TransferableFungible',
    },
  } satisfies IrsInstrumentPayload,
})

describe('ExportFpmlButton', () => {
  let createObjectURL: ReturnType<typeof vi.fn>
  let revokeObjectURL: ReturnType<typeof vi.fn>
  let clickSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    createObjectURL = vi.fn().mockReturnValue('blob:mock-url')
    revokeObjectURL = vi.fn()
    // vitest 4's `Mock` type is not structurally assignable to the strict
    // overloaded URL.createObjectURL signature — cast once at the assignment.
    globalThis.URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL
    globalThis.URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL
    clickSpy = vi.fn()
    // Intercept at the prototype level — spying on `document.createElement`
    // triggers infinite recursion under vitest 4's jsdom, and RTL's render
    // calls createElement heavily.
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      clickSpy as unknown as () => void,
    )
  })

  it('renders nothing when swapType is unsupported (BASIS/XCCY)', () => {
    const { container } = render(
      <ExportFpmlButton
        swapType="BASIS"
        notional="50000000"
        instrument={mkIrsInstrument()}
        workflowContractId="cid-42"
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing while instrument is loading', () => {
    const { container } = render(
      <ExportFpmlButton
        swapType="IRS"
        notional="10000000"
        instrument={null}
        workflowContractId="cid-42"
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('IRS workflow: click downloads a blob + revokes the URL', () => {
    render(
      <ExportFpmlButton
        swapType="IRS"
        notional="10000000"
        instrument={mkIrsInstrument()}
        workflowContractId="cid-abcdefghij"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /export fpml/i }))

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    const blob: Blob = createObjectURL.mock.calls[0][0]
    expect(blob.type).toBe('application/xml')
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })
})
