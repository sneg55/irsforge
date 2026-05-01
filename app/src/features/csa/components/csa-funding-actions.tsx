'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useLedgerClient } from '@/shared/hooks/use-ledger-client'
import type { CsaState } from '@/shared/ledger/types'
import { makeCsaPairResolver, postCollateral, withdrawExcess } from '../ledger/csa-actions'
import { CsaAmountModal, type CsaAmountMode } from './csa-amount-modal'
import { CsaDisputeModal } from './csa-dispute-modal'

interface Props {
  csaCid: string
  /** Party A of the CSA pair — the stable identity across cid rotation. */
  pairPartyA: string
  /** Party B of the CSA pair — the stable identity across cid rotation. */
  pairPartyB: string
  ccy: string
  postedByMe: number
  party: string
  currentExposure: number | null
  state: CsaState
}

export function CsaFundingActions({
  csaCid,
  pairPartyA,
  pairPartyB,
  ccy,
  postedByMe,
  party,
  currentExposure,
  state,
}: Props) {
  const { client } = useLedgerClient()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [amountMode, setAmountMode] = useState<CsaAmountMode | null>(null)
  const [disputeOpen, setDisputeOpen] = useState(false)

  // Resolver re-queries the latest CSA cid by pair on `CONTRACT_NOT_FOUND`.
  // The scheduler archives + re-creates the CSA on every PublishMark /
  // SettleVm, so any cid the UI holds goes stale within a tick.
  const resolveFreshCid = useMemo(
    () => (client ? makeCsaPairResolver(client, pairPartyA, pairPartyB) : undefined),
    [client, pairPartyA, pairPartyB],
  )

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['csas'] })
  }

  const handleAmountSubmit = async (n: number) => {
    if (!client || !amountMode) return
    setError(null)
    setBusy(true)
    try {
      if (amountMode === 'post') {
        await postCollateral(client, csaCid, party, ccy, n, resolveFreshCid)
      } else {
        await withdrawExcess(client, csaCid, party, ccy, n, resolveFreshCid)
      }
      refresh()
    } catch (e) {
      setError((e as Error).message)
      throw e
    } finally {
      setBusy(false)
    }
  }

  // Disable funding + dispute when the CSA is sitting in a dispute window
  // (MarkDisputed or Escalated) — funding mutates csb, which is undefined
  // while the active mark is contested, and re-disputing is illegal until
  // the active dispute resolves.
  const inDisputeWindow = state === 'MarkDisputed' || state === 'Escalated'
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button
          disabled={busy || inDisputeWindow}
          onClick={() => setAmountMode('post')}
          className="rounded bg-emerald-600 px-3 py-1.5 text-[11px] text-white disabled:opacity-40"
        >
          Post
        </button>
        <button
          disabled={busy || postedByMe === 0 || inDisputeWindow}
          onClick={() => setAmountMode('withdraw')}
          className="rounded bg-zinc-700 px-3 py-1.5 text-[11px] text-white disabled:opacity-40"
        >
          Withdraw
        </button>
        <button
          disabled={busy || inDisputeWindow}
          onClick={() => setDisputeOpen(true)}
          className="rounded bg-amber-700 px-3 py-1.5 text-[11px] text-white disabled:opacity-40"
        >
          Dispute
        </button>
      </div>
      {error && <div className="text-[10px] text-rose-400">{error}</div>}
      <CsaAmountModal
        isOpen={amountMode !== null}
        mode={amountMode ?? 'post'}
        ccy={ccy}
        max={amountMode === 'withdraw' ? postedByMe : undefined}
        onClose={() => setAmountMode(null)}
        onSubmit={handleAmountSubmit}
      />
      <CsaDisputeModal
        isOpen={disputeOpen}
        onClose={() => setDisputeOpen(false)}
        csaCid={csaCid}
        pairPartyA={pairPartyA}
        pairPartyB={pairPartyB}
        party={party}
        currentExposure={currentExposure}
      />
    </div>
  )
}
