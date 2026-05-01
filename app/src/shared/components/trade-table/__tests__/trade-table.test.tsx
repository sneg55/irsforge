import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TradeTable } from '../trade-table'

interface Row {
  id: string
  name: string
  notional: number
}

const COLS = [
  { key: 'name', header: 'Name', render: (r: Row) => r.name },
  { key: 'notional', header: 'Notional', render: (r: Row) => String(r.notional) },
]

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
})
