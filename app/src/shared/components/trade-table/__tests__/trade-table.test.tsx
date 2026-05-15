import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TradeTable } from '../trade-table'
import type { TradeTableColumn } from '../types'

interface Row {
  id: string
  name: string
  notional: number
}

const COLS = [
  { key: 'name', header: 'Name', render: (r: Row) => r.name },
  { key: 'notional', header: 'Notional', render: (r: Row) => String(r.notional) },
]

const SORTABLE_COLS: TradeTableColumn<Row>[] = [
  {
    key: 'name',
    header: 'Name',
    render: (r) => r.name,
    sortBy: (r) => r.name,
    sortDirection: 'asc',
  },
  {
    key: 'notional',
    header: 'Notional',
    render: (r) => String(r.notional),
    sortBy: (r) => r.notional,
  },
]

const SORTABLE_ROWS: Row[] = [
  { id: 'a', name: 'Alice', notional: 100 },
  { id: 'b', name: 'Bob', notional: 300 },
  { id: 'c', name: 'Charlie', notional: 200 },
]

function bodyRowNames(): string[] {
  return Array.from(document.querySelectorAll('tbody tr')).map(
    (tr) => tr.querySelector('td')?.textContent ?? '',
  )
}

describe('TradeTable', () => {
  it('renders headers and rows', () => {
    render(
      <TradeTable
        rows={[
          { id: 'a', name: 'Alice', notional: 100 },
          { id: 'b', name: 'Bob', notional: 200 },
        ]}
        columns={COLS}
        rowKey={(r) => r.id}
      />,
    )
    expect(screen.queryByText('Name')).not.toBe(null)
    expect(screen.queryByText('Alice')).not.toBe(null)
    expect(screen.queryByText('Bob')).not.toBe(null)
    expect(screen.queryByText('200')).not.toBe(null)
  })

  it('fires onRowClick when a row is clicked', () => {
    const onClick = vi.fn()
    render(
      <TradeTable
        rows={[{ id: 'a', name: 'Alice', notional: 100 }]}
        columns={COLS}
        onRowClick={onClick}
        rowKey={(r) => r.id}
      />,
    )
    fireEvent.click(screen.getByText('Alice'))
    expect(onClick).toHaveBeenCalledWith({ id: 'a', name: 'Alice', notional: 100 })
  })

  it('renders empty message when rows is empty', () => {
    render(<TradeTable rows={[]} columns={COLS} rowKey={(r) => r.id} emptyMessage="None" />)
    expect(screen.queryByText('None')).not.toBe(null)
  })

  it('renders loading skeleton when isLoading', () => {
    const { container } = render(
      <TradeTable rows={[]} columns={COLS} rowKey={(r) => r.id} isLoading />,
    )
    expect(container.querySelectorAll('[data-slot="trade-table-skel"]').length).toBeGreaterThan(0)
  })

  it('renders sortable header as a button only for columns with sortBy', () => {
    render(<TradeTable rows={SORTABLE_ROWS} columns={SORTABLE_COLS} rowKey={(r) => r.id} />)
    expect(screen.getByRole('button', { name: /Name/i })).not.toBe(null)
    expect(screen.getByRole('button', { name: /Notional/i })).not.toBe(null)
  })

  it('renders rows in input order when no sort is applied', () => {
    render(<TradeTable rows={SORTABLE_ROWS} columns={SORTABLE_COLS} rowKey={(r) => r.id} />)
    expect(bodyRowNames()).toEqual(['Alice', 'Bob', 'Charlie'])
  })

  it('applies defaultSort on mount', () => {
    render(
      <TradeTable
        rows={SORTABLE_ROWS}
        columns={SORTABLE_COLS}
        rowKey={(r) => r.id}
        defaultSort={{ key: 'notional', direction: 'desc' }}
      />,
    )
    expect(bodyRowNames()).toEqual(['Bob', 'Charlie', 'Alice'])
  })

  it('sorts on header click and toggles direction on second click', () => {
    render(<TradeTable rows={SORTABLE_ROWS} columns={SORTABLE_COLS} rowKey={(r) => r.id} />)
    const header = screen.getByRole('button', { name: /Notional/i })
    fireEvent.click(header)
    // sortDirection unspecified on the notional column → defaults to desc.
    expect(bodyRowNames()).toEqual(['Bob', 'Charlie', 'Alice'])
    fireEvent.click(header)
    expect(bodyRowNames()).toEqual(['Alice', 'Charlie', 'Bob'])
  })

  it('honors column-declared sortDirection on first click', () => {
    render(<TradeTable rows={SORTABLE_ROWS} columns={SORTABLE_COLS} rowKey={(r) => r.id} />)
    const header = screen.getByRole('button', { name: /Name/i })
    fireEvent.click(header)
    // name column declares sortDirection 'asc' — first click sorts ascending.
    expect(bodyRowNames()).toEqual(['Alice', 'Bob', 'Charlie'])
  })

  it('exposes aria-sort on the active column header', () => {
    render(
      <TradeTable
        rows={SORTABLE_ROWS}
        columns={SORTABLE_COLS}
        rowKey={(r) => r.id}
        defaultSort={{ key: 'notional', direction: 'desc' }}
      />,
    )
    const activeTh = document.querySelector('th[aria-sort]')
    expect(activeTh?.getAttribute('aria-sort')).toBe('descending')
  })
})
