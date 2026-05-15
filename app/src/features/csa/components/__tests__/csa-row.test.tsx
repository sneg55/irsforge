import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'

vi.mock('canton-party-directory/ui', () => ({
  PartyName: ({ identifier }: { identifier: string }) => <span>{identifier.split('::')[0]}</span>,
}))
vi.mock('@/shared/ledger/party-match', () => ({
  partyMatchesHint: (party: string, hint: string) => party.split('::')[0] === hint.split('::')[0],
  hintFromParty: (p: string) => p.split('::')[0],
}))

import type { CallSignal } from '../../call-amount'
import type { CsaViewModel } from '../../decode'
import { CsaRow } from '../csa-row'

afterEach(() => cleanup())

const baseCsa: CsaViewModel = {
  contractId: 'cid-1',
  partyA: 'Goldman::1220abcd',
  partyB: 'JPMorgan::1220ef01',
  state: 'MarginCallOutstanding',
  thresholdDirA: 0,
  thresholdDirB: 0,
  mta: 100_000,
  rounding: 10_000,
  valuationCcy: 'USD',
  postedByA: new Map([['USD', 5_000_000]]),
  postedByB: new Map(),
  // Fields below are not read by CsaRow but required by CsaViewModel.
  eligible: [],
  isdaMasterAgreementRef: '',
  governingLaw: 'NewYork',
  imAmount: 0,
  activeDispute: null,
  // biome-ignore lint/suspicious/noExplicitAny: minimal viewmodel for the table-cell test
} as any

function inTable(node: React.ReactNode) {
  return render(
    <table>
      <tbody>{node}</tbody>
    </table>,
  )
}

const callSignalB: CallSignal = { side: 'B', amount: 13_640_000 }

describe('CsaRow — call/return cell', () => {
  test('renders "Post $X" when the active party is the funder side', () => {
    const { container } = inTable(
      <CsaRow
        csa={baseCsa}
        expanded={false}
        onToggle={() => {}}
        latestExposure={-8_639_835}
        callSignal={callSignalB}
        activeParty="JPMorgan"
      />,
    )
    expect(container.textContent).toContain('Post $13,640,000')
    expect(container.textContent).not.toMatch(/Call \$13,640,000/)
  })

  test('renders "Call $X from <funder>" when the active party is the counterparty', () => {
    const { container } = inTable(
      <CsaRow
        csa={baseCsa}
        expanded={false}
        onToggle={() => {}}
        latestExposure={-8_639_835}
        callSignal={callSignalB}
        activeParty="Goldman"
      />,
    )
    expect(container.textContent).toContain('Call $13,640,000')
    expect(container.textContent).toContain('JPMorgan')
    expect(container.textContent).not.toContain('Post $13,640,000')
  })

  test('renders em-dash when no call signal is outstanding', () => {
    const { container } = inTable(
      <CsaRow
        csa={baseCsa}
        expanded={false}
        onToggle={() => {}}
        latestExposure={0}
        callSignal={null}
        activeParty="Goldman"
      />,
    )
    // Em dash sits inside the call/return cell (3rd <td>).
    const cells = container.querySelectorAll('td')
    expect(cells[2]?.textContent).toContain('—')
  })
})

describe('CsaRow — pledger cell + interaction', () => {
  test('shows Goldman as the pledger when only A has posted', () => {
    const { container } = inTable(
      <CsaRow
        csa={baseCsa}
        expanded={false}
        onToggle={() => {}}
        latestExposure={null}
        callSignal={null}
        activeParty="JPMorgan"
      />,
    )
    // Pledger cell is the 4th <td>.
    const pledgerCell = container.querySelectorAll('td')[3]
    expect(pledgerCell?.textContent).toContain('Goldman')
    expect(pledgerCell?.textContent).toContain('$5,000,000')
  })

  test('shows em-dash when neither side has posted', () => {
    const csaNoPledge: CsaViewModel = { ...baseCsa, postedByA: new Map(), postedByB: new Map() }
    const { container } = inTable(
      <CsaRow
        csa={csaNoPledge}
        expanded={false}
        onToggle={() => {}}
        latestExposure={null}
        callSignal={null}
        activeParty="JPMorgan"
      />,
    )
    expect(container.querySelectorAll('td')[3]?.textContent).toContain('—')
  })

  test('clicking the row fires onToggle', () => {
    const onToggle = vi.fn()
    const { container } = inTable(
      <CsaRow
        csa={baseCsa}
        expanded={false}
        onToggle={onToggle}
        latestExposure={null}
        callSignal={null}
        activeParty="JPMorgan"
      />,
    )
    fireEvent.click(container.querySelector('tr')!)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  test('renders em-dash for exposure when latestExposure is null', () => {
    const { container } = inTable(
      <CsaRow
        csa={baseCsa}
        expanded={false}
        onToggle={() => {}}
        latestExposure={null}
        callSignal={null}
        activeParty="JPMorgan"
      />,
    )
    // Exposure cell is the 2nd <td>.
    expect(container.querySelectorAll('td')[1]?.textContent).toContain('—')
  })
})
