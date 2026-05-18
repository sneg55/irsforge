'use client'

import { useMemo, useState } from 'react'
import { LivenessDot } from '@/components/ui/liveness-dot'
import { Skeleton } from '@/components/ui/skeleton'
import { phaseToLiveness } from '@/shared/hooks/use-stream-phase'
import { TimelineEventCard } from '../components/timeline-event-card'
import { TimelineFilterBar } from '../components/timeline-filter-bar'
import { useBusinessEvents } from '../hooks/use-business-events'
import { type BusinessEventKind, isSystemKind } from './business-events'

function TimelineSkeletonList() {
  return (
    <div className="flex flex-col gap-2" data-testid="timeline-skeleton-list">
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3"
        >
          <Skeleton className="h-2 w-2 rounded-full" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="ml-auto h-4 w-20" />
        </div>
      ))}
    </div>
  )
}

export function TimelinePage() {
  const { events, phase } = useBusinessEvents()
  const [includeSystem, setIncludeSystem] = useState(false)
  const [kindFilter, setKindFilter] = useState<Set<BusinessEventKind>>(new Set())

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (!includeSystem && isSystemKind(e.kind)) return false
      if (kindFilter.size > 0 && !kindFilter.has(e.kind)) return false
      return true
    })
  }, [events, includeSystem, kindFilter])

  function toggleKind(k: BusinessEventKind) {
    setKindFilter((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
  }

  const isInitial = phase === 'initial' && events.length === 0

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="text-3xl font-bold text-white tracking-tight">Timeline</h1>
          <LivenessDot state={phaseToLiveness(phase)} />
        </div>
        <p className="text-xs text-zinc-500">
          {filtered.length} {filtered.length === 1 ? 'event' : 'events'}
        </p>
      </header>
      <TimelineFilterBar
        includeSystem={includeSystem}
        setIncludeSystem={setIncludeSystem}
        kindFilter={kindFilter}
        toggleKind={toggleKind}
        clearKindFilter={() => setKindFilter(new Set())}
      />
      {isInitial ? (
        <TimelineSkeletonList />
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-6 py-8 text-center text-sm text-zinc-500">
          No events yet, the regulator timeline shows trades, marks, and CSA activity as they land
          on the ledger.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((e) => (
            <TimelineEventCard key={e.cid + e.kind} event={e} />
          ))}
        </div>
      )}
    </div>
  )
}
