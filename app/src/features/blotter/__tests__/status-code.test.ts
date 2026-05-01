import { describe, expect, it } from 'vitest'
import { statusCodeFor } from '../status-code'

describe('statusCodeFor', () => {
  it('Active row with no pendingUnwind → LIVE in zinc-500', () => {
    expect(statusCodeFor('active', 'Active')).toEqual({ code: 'LIVE', colorClass: 'text-zinc-500' })
  })

  it('Active row with UnwindPending → PEND UNWD in amber-400', () => {
    expect(statusCodeFor('active', 'UnwindPending')).toEqual({
      code: 'PEND UNWD',
      colorClass: 'text-amber-400',
    })
  })

  it('proposals tab → PEND', () => {
    expect(statusCodeFor('proposals', 'Proposed')).toEqual({
      code: 'PEND',
      colorClass: 'text-zinc-400',
    })
  })

  it('drafts tab → DRAFT', () => {
    expect(statusCodeFor('drafts', 'Draft')).toEqual({ code: 'DRAFT', colorClass: 'text-zinc-500' })
  })

  it('matured tab → MAT', () => {
    expect(statusCodeFor('matured', 'Matured')).toEqual({
      code: 'MAT',
      colorClass: 'text-zinc-500',
    })
  })

  it('unwound tab → UNWD', () => {
    expect(statusCodeFor('unwound', 'Unwound')).toEqual({
      code: 'UNWD',
      colorClass: 'text-zinc-500',
    })
  })
})
