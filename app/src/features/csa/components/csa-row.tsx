'use client'

import { PartyName } from 'canton-party-directory/ui'
import type { CallSignal } from '../call-amount'
import type { CsaViewModel } from '../decode'
import { CsaStateBadge } from './csa-state-badge'

interface Props {
  csa: CsaViewModel
  expanded: boolean
  onToggle: () => void
  latestExposure: number | null
  callSignal: CallSignal | null
}

const fmt = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export function CsaRow({ csa, expanded, onToggle, latestExposure, callSignal }: Props) {
  const postedA = csa.postedByA.get(csa.valuationCcy) ?? 0
  const postedB = csa.postedByB.get(csa.valuationCcy) ?? 0
  // CSB invariant: at most one side is pledgor at a time. Surface the
  // active pledgor as `<Name> · $amount` and otherwise "—".
  const pledgor =
    postedA > 0
      ? { party: csa.partyA, amount: postedA }
      : postedB > 0
        ? { party: csa.partyB, amount: postedB }
        : null
  const callParty = callSignal ? (callSignal.side === 'A' ? csa.partyA : csa.partyB) : null
  return (
    <tr
      onClick={onToggle}
      className={`cursor-pointer border-b border-zinc-800/50 bg-zinc-950 hover:bg-zinc-900 transition-colors ${expanded ? 'bg-zinc-900' : ''}`}
    >
      <td className="px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <PartyName identifier={csa.partyA} />
          <span className="text-zinc-600">↔</span>
          <PartyName identifier={csa.partyB} />
        </div>
      </td>
      <td
        className={`px-4 py-3 text-right font-mono ${latestExposure !== null ? 'text-zinc-300' : 'text-zinc-600'}`}
      >
        {latestExposure !== null ? fmt(latestExposure) : '—'}
      </td>
      <td className="px-4 py-3 text-right font-mono text-xs">
        {callSignal && callParty ? (
          <span className="text-rose-400">
            Call {fmt(callSignal.amount)} from <PartyName identifier={callParty} />
          </span>
        ) : (
          <span className="text-zinc-600">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-right font-mono text-zinc-300 text-xs">
        {pledgor ? (
          <span>
            <PartyName identifier={pledgor.party} /> <span className="text-zinc-600">·</span>{' '}
            {fmt(pledgor.amount)}
          </span>
        ) : (
          <span className="text-zinc-600">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-right font-mono text-zinc-400 text-xs">
        <PartyName identifier={csa.partyA} /> {fmt(csa.thresholdDirA)}{' '}
        <span className="text-zinc-600">·</span> <PartyName identifier={csa.partyB} />{' '}
        {fmt(csa.thresholdDirB)}
      </td>
      <td className="px-4 py-3 text-right font-mono text-zinc-400">{fmt(csa.mta)}</td>
      <td className="px-4 py-3 text-right font-mono text-zinc-400">{fmt(csa.rounding)}</td>
      <td className="px-4 py-3">
        <CsaStateBadge state={csa.state} />
      </td>
    </tr>
  )
}
