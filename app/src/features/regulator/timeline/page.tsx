'use client'

import { useMemo, useState } from 'react'
import { TimelineEventCard } from '../components/timeline-event-card'
import { TimelineFilterBar } from '../components/timeline-filter-bar'
import { useBusinessEvents } from '../hooks/use-business-events'
import { type BusinessEventKind, isSystemKind } from './business-events'

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

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white tracking-tight">Timeline</h1>
        <p className="text-xs text-zinc-500">
          {filtered.length} events · stream: <span className="font-mono">{phase}</span>
        </p>
      </header>
      <TimelineFilterBar
        includeSystem={includeSystem}
        setIncludeSystem={setIncludeSystem}
        kindFilter={kindFilter}
        toggleKind={toggleKind}
        clearKindFilter={() => setKindFilter(new Set())}
      />
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-6 py-8 text-center text-sm text-zinc-500">
          No events yet — the regulator timeline shows trades, marks, and CSA activity as they land
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
