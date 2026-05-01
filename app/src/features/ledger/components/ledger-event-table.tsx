'use client'

import { PartyName } from 'canton-party-directory/ui'
import type { LedgerActivityEvent } from '../types'
import { kindColorClass, shortTemplate } from '../utils'

function shortTime(ts: number): string {
  return new Date(ts).toLocaleTimeString()
}

interface Props {
  events: LedgerActivityEvent[]
  onRowClick: (e: LedgerActivityEvent) => void
}

export function LedgerEventTable({ events, onRowClick }: Props) {
  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-center text-sm text-zinc-500">
        No activity yet — waiting for the next ledger tick.
      </div>
    )
  }
  return (
    <table className="w-full table-fixed border-collapse text-xs">
      <thead>
        <tr className="border-b border-zinc-800 text-left text-[10px] uppercase tracking-wider text-zinc-500">
          <th className="w-24 p-2">Kind</th>
          <th className="p-2">Template</th>
          <th className="w-28 p-2">Party</th>
          <th className="w-32 p-2">Cid</th>
          <th className="w-24 p-2">Time</th>
        </tr>
      </thead>
      <tbody>
        {events.map((e, i) => (
          <tr
            key={`${e.ts}-${e.contractId}-${e.kind}-${i}`}
            onClick={() => onRowClick(e)}
            className="cursor-pointer border-b border-zinc-900 hover:bg-zinc-900/70"
          >
            <td className="p-2 font-mono text-[10px] uppercase">
              <span className={kindColorClass(e.kind)}>{e.kind}</span>
            </td>
            <td className="truncate p-2 text-zinc-200">
              {shortTemplate(e.templateId)}
              {e.choice ? <span className="ml-2 text-amber-300">{e.choice}</span> : null}
            </td>
            <td className="p-2 text-zinc-400">
              {e.party ? <PartyName identifier={e.party} /> : '—'}
            </td>
            <td className="truncate p-2 font-mono text-[10px] text-blue-400">
              {e.contractId.slice(0, 12)}…
            </td>
            <td className="p-2 text-zinc-500">{shortTime(e.ts)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
