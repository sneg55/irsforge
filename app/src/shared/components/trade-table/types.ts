import type { ReactNode } from 'react'

export type SortDirection = 'asc' | 'desc'

export interface TradeTableColumn<Row> {
  key: string
  header: string
  width?: string
  render: (row: Row) => ReactNode
  // Sort key extractor. Presence of this field is what makes a column
  // sortable from the header. Returning null/undefined puts the row at the
  // bottom of the order regardless of direction.
  sortBy?: (row: Row) => string | number | null | undefined
  // Direction the column moves to on its first header click. Defaults to
  // 'desc' (newest/largest first) which matches most financial-table
  // intuitions; set 'asc' for things like counterparty name.
  sortDirection?: SortDirection
}

export interface TradeTableSort {
  key: string
  direction: SortDirection
}

export interface TradeTableProps<Row> {
  rows: Row[]
  columns: TradeTableColumn<Row>[]
  onRowClick?: (row: Row) => void
  isLoading?: boolean
  emptyMessage?: string
  rowKey: (row: Row) => string
  // Initial sort applied to `rows`. When omitted the table renders rows in
  // input order — that's the reference-impl boundary: the caller is
  // responsible for any default ordering, and the user can override via
  // column-header clicks here.
  defaultSort?: TradeTableSort
}
