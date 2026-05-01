'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import { LivenessDot } from '@/components/ui/liveness-dot'
import { Skeleton } from '@/components/ui/skeleton'
import { useConfig } from '@/shared/contexts/config-context'
import { phaseToLiveness } from '@/shared/hooks/use-stream-phase'
import { LedgerEventDrawer } from './components/ledger-event-drawer'
import { LedgerEventTable } from './components/ledger-event-table'
import { LedgerFilterBar } from './components/ledger-filter-bar'
import { useLedgerActivityContext } from './contexts/ledger-activity-provider'
import { filterEvents } from './hooks/use-ledger-activity'
import type { LedgerActivityFilter } from './types'

function LedgerListSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800">
      {Array.from({ length: 8 }, (_, i) => (
        <div
          key={i}
          data-slot="ledger-skeleton-row"
          className="flex items-center gap-4 border-b border-zinc-800/50 px-4 py-3 last:border-b-0"
        >
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="ml-auto h-4 w-20" />
        </div>
      ))}
    </div>
  )
}

export default function LedgerPage() {
  const { events, denyPrefixes, systemPrefixes, phase } = useLedgerActivityContext()
  const { config } = useConfig()
  const rawPayloadEnabled = config?.ledgerUi?.rawPayload.enabled ?? true

  const router = useRouter()
  const searchParams = useSearchParams()
  const cidParam = searchParams.get('cid')
  const templateParam = searchParams.get('template')

  const [filter, setFilter] = useState<LedgerActivityFilter>({
    kinds: ['create', 'exercise', 'archive'],
  })

  // ?template=<prefix> deep-links scope the activity feed to one
  // template prefix. Forces includeSystem=true so bootstrap rows
  // (system-prefixed via YAML) aren't filtered out when surfaced
  // intentionally from the bootstrap-status-card view links.
  const filtered = useMemo(
    () =>
      filterEvents(events, {
        ...filter,
        templateAllow: templateParam ? [templateParam] : filter.templateAllow,
        includeSystem: templateParam ? true : filter.includeSystem,
        templateDeny: [...(filter.templateDeny ?? []), ...denyPrefixes],
        systemPrefixes,
      }),
    [events, filter, templateParam, denyPrefixes, systemPrefixes],
  )

  const closeDrawer = () => {
    const url = new URL(window.location.href)
    url.searchParams.delete('cid')
    router.replace(url.pathname + (url.search || ''))
  }

  const clearTemplateFilter = () => {
    const url = new URL(window.location.href)
    url.searchParams.delete('template')
    router.replace(url.pathname + (url.search || ''))
  }

  return (
    <>
      <div className={`space-y-4 ${cidParam ? 'pr-[480px]' : ''}`}>
        <header className="flex items-baseline gap-3">
          <h1 className="text-3xl font-bold text-white tracking-tight">Ledger Activity</h1>
          <span className="rounded bg-zinc-900 px-2 py-0.5 font-mono text-[11px] text-zinc-400">
            {filtered.length} events
          </span>
          {templateParam && (
            <button
              type="button"
              data-testid="ledger-template-filter-pill"
              onClick={clearTemplateFilter}
              className="flex items-center gap-1 rounded bg-zinc-800 px-2 py-0.5 font-mono text-[11px] text-zinc-300 hover:bg-zinc-700"
              title="Clear template filter"
            >
              template:{templateParam}
              <span className="text-zinc-500">×</span>
            </button>
          )}
          <span className="ml-auto flex items-center gap-2 text-[11px] uppercase tracking-wider text-zinc-500">
            <LivenessDot state={phaseToLiveness(phase)} />
            live
          </span>
        </header>
        <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
          <LedgerFilterBar value={filter} onChange={setFilter} />
          {phase === 'initial' ? (
            <LedgerListSkeleton />
          ) : (
            <LedgerEventTable
              events={filtered}
              onRowClick={(e) => router.push(`?cid=${encodeURIComponent(e.contractId)}`)}
            />
          )}
        </div>
      </div>
      <LedgerEventDrawer
        cid={cidParam}
        events={events}
        rawPayloadEnabled={rawPayloadEnabled}
        onClose={closeDrawer}
      />
    </>
  )
}
