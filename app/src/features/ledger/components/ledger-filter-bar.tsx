'use client'

import type { ChangeEvent } from 'react'
import type { LedgerActivityFilter, LedgerActivityKind } from '../types'

const ALL_KINDS: LedgerActivityKind[] = ['create', 'exercise', 'archive']

interface Props {
  value: LedgerActivityFilter
  onChange: (next: LedgerActivityFilter) => void
}

export function LedgerFilterBar({ value, onChange }: Props) {
  const selected = new Set(value.kinds ?? ALL_KINDS)

  const toggleKind = (k: LedgerActivityKind) => {
    const next = new Set(selected)
    if (next.has(k)) next.delete(k)
    else next.add(k)
    onChange({ ...value, kinds: Array.from(next) })
  }

  const handleCidChange = (e: ChangeEvent<HTMLInputElement>) => {
    const cidPrefix = e.target.value || undefined
    onChange({ ...value, cidPrefix })
  }

  return (
    <div className="flex items-center gap-3 border-b border-zinc-800 bg-zinc-950 p-3 text-xs">
      <div className="flex gap-1">
        {ALL_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => toggleKind(k)}
            className={`rounded px-2 py-1 font-mono text-2xs uppercase tracking-wider ${
              selected.has(k)
                ? k === 'create'
                  ? 'bg-green-900/60 text-green-300'
                  : k === 'exercise'
                    ? 'bg-amber-900/60 text-amber-300'
                    : 'bg-red-900/60 text-red-300'
                : 'bg-zinc-900 text-zinc-500 hover:bg-zinc-800'
            }`}
          >
            {k}
          </button>
        ))}
      </div>
      <input
        type="text"
        placeholder="Filter by cid prefix…"
        value={value.cidPrefix ?? ''}
        onChange={handleCidChange}
        className="flex-1 rounded border border-zinc-800 bg-zinc-900 px-3 py-1 font-mono text-2xs text-zinc-200 placeholder:text-zinc-600"
      />
      <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-2xs font-medium uppercase tracking-wider text-zinc-400">
        <input
          type="checkbox"
          checked={value.includeSystem === true}
          onChange={(e) => onChange({ ...value, includeSystem: e.target.checked })}
          className="h-3 w-3 cursor-pointer"
        />
        <span>Show system</span>
      </label>
    </div>
  )
}
