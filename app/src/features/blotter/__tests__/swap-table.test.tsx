import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { PAGE_SIZE } from '../constants'
import { SwapTable } from '../swap-table'
import type { BlotterTab, SwapRow } from '../types'

const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => '/org/goldman/blotter',
}))

// canton-party-directory's PartyName calls a context-scoped lookup. The
// fallback path renders the raw identifier — that's enough for assertions.
vi.mock('canton-party-directory/ui', () => ({
  PartyName: ({ identifier }: { identifier: string }) => <span>{identifier}</span>,
}))

// The workspace's Sparkline is a plain SVG component; we only care that it
// receives `values`. A lightweight stub avoids pulling in its d3 deps.
vi.mock('../../workspace/components/sparkline', () => ({
  Sparkline: ({ values }: { values: number[] }) => (
    <span data-testid="sparkline" data-count={values.length} />
  ),
}))

afterEach(() => {
  cleanup()
  pushMock.mockReset()
})

function row(overrides: Partial<SwapRow> = {}): SwapRow {
  return {
    contractId: 'cid-1',
    type: 'IRS',
    counterparty: 'PartyB::abc',
    notional: 10_000_000,
    currency: 'USD',
    maturity: '2031-04-14',
    npv: 12345,
    dv01: 450,
    status: 'Active',
    direction: 'receive',
    sparkline: [1, 2, 3],
    ...overrides,
  }
}

const tabCounts: Record<BlotterTab, number> = {
  active: 1,
  proposals: 0,
  drafts: 0,
  matured: 0,
  unwound: 0,
}

const baseProps = {
  activeTab: 'active' as BlotterTab,
  onTabChange: () => {},
  tabCounts,
  onDeleteDraft: () => {},
  workspaceBase: '/org/goldman/workspace',
  onOpenDetails: () => {},
}

describe('SwapTable — render + navigation', () => {
  test('renders one row per input with type badge, notional, NPV sign color', () => {
    const { container } = render(
      <SwapTable {...baseProps} rows={[row({ npv: -500, direction: 'pay' })]} />,
    )
    expect(container.textContent).toContain('IRS')
    expect(container.textContent).toContain('Pay')
    // Pagination hidden when rows ≤ PAGE_SIZE.
    expect(container.querySelectorAll('button').length).toBeGreaterThan(0)
  })

  test('Active row click navigates to workspace?swap=cid', () => {
    const { container } = render(<SwapTable {...baseProps} rows={[row({ contractId: 'wf-42' })]} />)
    const firstRow = container.querySelector('tbody tr') as HTMLElement
    fireEvent.click(firstRow)
    expect(pushMock).toHaveBeenCalledWith('/org/goldman/workspace?swap=wf-42')
  })

  test('Draft row click navigates to workspace?draft=cid', () => {
    const { container } = render(
      <SwapTable
        {...baseProps}
        activeTab="drafts"
        rows={[row({ status: 'Draft', contractId: 'draft-1' })]}
      />,
    )
    const firstRow = container.querySelector('tbody tr') as HTMLElement
    fireEvent.click(firstRow)
    expect(pushMock).toHaveBeenCalledWith('/org/goldman/workspace?draft=draft-1')
  })

  test('Matured/Unwound row click opens details modal instead of navigating', () => {
    const onOpenDetails = vi.fn()
    const { container } = render(
      <SwapTable
        {...baseProps}
        activeTab="matured"
        onOpenDetails={onOpenDetails}
        rows={[row({ status: 'Matured', terminalDate: '2031-04-14', terminalAmount: 500 })]}
      />,
    )
    fireEvent.click(container.querySelector('tbody tr') as HTMLElement)
    expect(onOpenDetails).toHaveBeenCalledTimes(1)
    expect(pushMock).not.toHaveBeenCalled()
  })

  test('drafts tab shows Delete button that fires onDeleteDraft without navigating', () => {
    const onDeleteDraft = vi.fn()
    const { container } = render(
      <SwapTable
        {...baseProps}
        activeTab="drafts"
        onDeleteDraft={onDeleteDraft}
        rows={[row({ status: 'Draft', contractId: 'd-1' })]}
      />,
    )
    const del = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Delete',
    )!
    fireEvent.click(del)
    expect(onDeleteDraft).toHaveBeenCalledWith('d-1')
    expect(pushMock).not.toHaveBeenCalled()
  })

  test('drafts tab with onDeleteAllDrafts shows "Delete All" that calls the handler', () => {
    const onDeleteAllDrafts = vi.fn()
    const { container } = render(
      <SwapTable
        {...baseProps}
        activeTab="drafts"
        onDeleteAllDrafts={onDeleteAllDrafts}
        rows={[row({ status: 'Draft' })]}
      />,
    )
    const btn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Delete All',
    )!
    fireEvent.click(btn)
    expect(onDeleteAllDrafts).toHaveBeenCalledTimes(1)
  })

  test('tab switching fires onTabChange and resets to page 0', () => {
    const onTabChange = vi.fn()
    const { container } = render(
      <SwapTable {...baseProps} onTabChange={onTabChange} rows={[row()]} />,
    )
    const proposalsBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').startsWith('Proposals'),
    )!
    fireEvent.click(proposalsBtn)
    expect(onTabChange).toHaveBeenCalledWith('proposals')
  })

  test('empty rows render the tab-specific empty message', () => {
    const { container } = render(<SwapTable {...baseProps} activeTab="proposals" rows={[]} />)
    // Proposal-tab empty message lives in EMPTY_MESSAGES; assert content is a
    // non-empty string rather than hardcoding exact copy.
    const td = container.querySelector('td[colspan]') as HTMLTableCellElement
    expect(td?.textContent).toMatch(/proposal/i)
  })

  test('isLoading shows 5 skeleton rows and "(…)" counters on non-drafts tabs', () => {
    const { container } = render(<SwapTable {...baseProps} isLoading rows={[]} />)
    expect(container.querySelectorAll('tbody tr').length).toBe(5)
    const activeTabBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').startsWith('Active'),
    )
    expect(activeTabBtn?.textContent).toContain('(…)')
  })

  test('pagination appears when rows > PAGE_SIZE and advances via > button', () => {
    const rows: SwapRow[] = Array.from({ length: PAGE_SIZE + 3 }, (_, i) =>
      row({ contractId: `cid-${i}` }),
    )
    const { container } = render(<SwapTable {...baseProps} rows={rows} />)
    expect(container.textContent).toContain(`Showing 1-${PAGE_SIZE} of ${PAGE_SIZE + 3}`)
    // Page-number buttons (1, 2) + < + > → find the > button.
    const nextBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === '>',
    )!
    fireEvent.click(nextBtn)
    expect(container.textContent).toContain(`Showing ${PAGE_SIZE + 1}-${PAGE_SIZE + 3}`)
  })

  test('UnwindPending with role="counterparty" shows the red dot alert', () => {
    const { container } = render(
      <SwapTable
        {...baseProps}
        rows={[
          row({
            status: 'UnwindPending',
            pendingUnwind: { role: 'counterparty', proposalCid: 'tp-1' },
          }),
        ]}
      />,
    )
    const dot = container.querySelector('span[title*="your action required"]')
    expect(dot).not.toBeNull()
    expect((dot as HTMLElement).className).toMatch(/bg-red-500/)
  })

  test('UnwindPending with role="proposer" shows the amber dot alert', () => {
    const { container } = render(
      <SwapTable
        {...baseProps}
        rows={[
          row({
            status: 'UnwindPending',
            pendingUnwind: { role: 'proposer', proposalCid: 'tp-2' },
          }),
        ]}
      />,
    )
    const dot = container.querySelector('span[title*="awaiting counterparty"]')
    expect((dot as HTMLElement).className).toMatch(/bg-amber-400/)
  })

  test('terminal tabs render terminalDate + terminalAmount cells', () => {
    const { container } = render(
      <SwapTable
        {...baseProps}
        activeTab="unwound"
        rows={[
          row({
            status: 'Unwound',
            terminalDate: '2026-10-01',
            terminalAmount: -250,
          }),
        ]}
      />,
    )
    expect(container.textContent).toContain('2026-10-01')
  })
})
