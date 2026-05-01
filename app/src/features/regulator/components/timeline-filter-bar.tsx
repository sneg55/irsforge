'use client'

import type { BusinessEventKind } from '../timeline/business-events'

interface Props {
  includeSystem: boolean
  setIncludeSystem: (v: boolean) => void
  kindFilter: Set<BusinessEventKind>
  toggleKind: (k: BusinessEventKind) => void
  clearKindFilter: () => void
}

const FILTERABLE_KINDS: BusinessEventKind[] = [
  'TradeProposed',
  'TradeAccepted',
  'TradeMatured',
  'TradeTerminated',
  'CsaPublished',
  'MarginCalled',
  // Dispute lifecycle replaces the single legacy `MarkDisputed` chip:
  // opened (bilateral), escalated (counterparty pushes to operator),
  // resolved (operator ack OR bilateral agree). Decoders for these
  // produce in Task 16.
  'DisputeOpened',
  'DisputeEscalated',
  'DisputeResolved',
  'MarkPosted',
  'NettedSettlement',
  'SettlementAudited',
  'ShortfallRecorded',
]

export function TimelineFilterBar({
  includeSystem,
  setIncludeSystem,
  kindFilter,
  toggleKind,
  clearKindFilter,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <button
        type="button"
        aria-label="filter-system"
        onClick={() => setIncludeSystem(!includeSystem)}
        className={`rounded px-2 py-1 ${
          includeSystem ? 'bg-blue-600 text-white' : 'bg-zinc-900 text-zinc-400'
        }`}
      >
        Include system events
      </button>
      <span className="text-zinc-700">|</span>
      {FILTERABLE_KINDS.map((k) => (
        <button
          key={k}
          type="button"
          aria-label={`filter-${k}`}
          onClick={() => toggleKind(k)}
          className={`rounded px-2 py-1 ${
            kindFilter.has(k) ? 'bg-blue-600 text-white' : 'bg-zinc-900 text-zinc-400'
          }`}
        >
          {k}
        </button>
      ))}
      {kindFilter.size > 0 && (
        <button
          type="button"
          aria-label="filter-clear"
          onClick={clearKindFilter}
          className="ml-2 rounded px-2 py-1 text-zinc-500 hover:text-white"
        >
          clear
        </button>
      )}
    </div>
  )
}
