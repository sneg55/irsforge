import type { BlotterTab, SwapRow } from './types'

export interface StatusCode {
  code: string
  colorClass: string
}

export function statusCodeFor(tab: BlotterTab, status: SwapRow['status']): StatusCode {
  if (tab === 'active') {
    if (status === 'UnwindPending') return { code: 'PEND UNWD', colorClass: 'text-amber-400' }
    return { code: 'LIVE', colorClass: 'text-zinc-500' }
  }
  if (tab === 'proposals') return { code: 'PEND', colorClass: 'text-zinc-400' }
  if (tab === 'drafts') return { code: 'DRAFT', colorClass: 'text-zinc-500' }
  if (tab === 'matured') return { code: 'MAT', colorClass: 'text-zinc-500' }
  return { code: 'UNWD', colorClass: 'text-zinc-500' }
}
