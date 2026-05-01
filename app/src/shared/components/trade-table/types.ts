import type { ReactNode } from 'react'

export interface TradeTableColumn<Row> {
  key: string
  header: string
  width?: string
  render: (row: Row) => ReactNode
  sortBy?: (row: Row) => string | number
}

export interface TradeTableProps<Row> {
  rows: Row[]
  columns: TradeTableColumn<Row>[]
  onRowClick?: (row: Row) => void
  isLoading?: boolean
  emptyMessage?: string
  rowKey: (row: Row) => string
}
