'use client'

import { useMemo } from 'react'
import { CsaBoardCard } from '../components/csa-board-card'
import { useAllCsas } from '../hooks/use-all-csas'
import { sortCsasByFriction } from './sort'

export function CsaBoardPage() {
  const { data, isLoading, error } = useAllCsas()
  const sorted = useMemo(() => sortCsasByFriction(data), [data])

  if (error) {
    return (
      <div className="rounded-lg border border-red-800 bg-red-950/20 p-4 text-sm text-red-300">
        Failed to load CSAs: {error.message}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-3xl font-bold text-white tracking-tight">CSA Board</h1>
        <p className="text-xs text-zinc-500">
          {data.length} active {data.length === 1 ? 'CSA' : 'CSAs'} across the platform — disputes
          and margin calls float to the top.
        </p>
      </header>
      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-lg border border-zinc-800 bg-zinc-900"
            />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-6 py-8 text-center text-sm text-zinc-500">
          No CSAs configured yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {sorted.map((c) => (
            <CsaBoardCard key={c.contractId} csa={c} />
          ))}
        </div>
      )}
    </div>
  )
}
