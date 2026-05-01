import type { CsaState } from '@/shared/ledger/types'

const COLOR: Record<CsaState, string> = {
  Active: 'bg-emerald-500/15 text-emerald-400',
  MarkDisputed: 'bg-amber-500/15 text-amber-400',
  MarginCallOutstanding: 'bg-rose-500/15 text-rose-400',
  Escalated: 'bg-rose-700/30 text-rose-200',
}

const LABEL: Record<CsaState, string> = {
  Active: 'Active',
  MarkDisputed: 'Disputed',
  MarginCallOutstanding: 'Margin Call',
  Escalated: 'Escalated',
}

export function CsaStateBadge({ state }: { state: CsaState }) {
  return (
    <span className={`inline-block px-2 py-0.5 text-[11px] font-mono rounded ${COLOR[state]}`}>
      {LABEL[state]}
    </span>
  )
}
