'use client'

import { useState } from 'react'
import type { CsaState } from '@/shared/ledger/types'
import { DisputeResolveModal } from './dispute-resolve-modal'

interface Props {
  csaCid: string
  pairPartyA: string
  pairPartyB: string
  ccy: string
  state: CsaState
  /** Current exposure from the latest mark observation — used as the
   *  default re-publish value when the operator acknowledges a dispute. */
  currentExposure: number | null
}

/**
 * Operator-only CSA controls. Today just `AcknowledgeDispute` via the
 * shared `DisputeResolveModal` (re-used by the operator queue row for
 * inline resolution without navigation).
 */
export function CsaOperatorActions({
  csaCid,
  pairPartyA,
  pairPartyB,
  ccy,
  state,
  currentExposure,
}: Props) {
  const [open, setOpen] = useState(false)

  if (state !== 'MarkDisputed' && state !== 'Escalated') {
    return (
      <div className="flex flex-col items-end gap-1 text-[11px] text-zinc-500">
        <div className="rounded border border-zinc-800 bg-zinc-900 px-3 py-1.5">
          Operator · no pending action
        </div>
      </div>
    )
  }

  const label = state === 'Escalated' ? 'Resolve escalated dispute' : 'Resolve dispute'

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={() => setOpen(true)}
        className="rounded bg-indigo-600 px-3 py-1.5 text-[11px] text-white hover:bg-indigo-500"
      >
        {label}
      </button>
      {open && (
        <DisputeResolveModal
          csaCid={csaCid}
          pairPartyA={pairPartyA}
          pairPartyB={pairPartyB}
          ccy={ccy}
          state={state}
          currentExposure={currentExposure}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}
