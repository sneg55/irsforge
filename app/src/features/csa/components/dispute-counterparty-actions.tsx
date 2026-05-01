'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useLedgerClient } from '@/shared/hooks/use-ledger-client'
import type { CsaState, DisputeReason } from '@/shared/ledger/csa-types'
import { agreeToCounterMark, escalateDispute, makeCsaPairResolver } from '../ledger/csa-actions'

export interface DisputeCounterpartyActionsProps {
  csaCid: string
  pairPartyA: string
  pairPartyB: string
  party: string
  /** Party who opened the dispute (from the active DisputeRecord). */
  disputer: string
  counterMark: number
  reason: DisputeReason
  notes: string
  ccy: string
  state: CsaState
}

const fmtCcy = (n: number, ccy: string) =>
  n.toLocaleString('en-US', { style: 'currency', currency: ccy, maximumFractionDigits: 2 })

/**
 * Counterparty-side controls when the active party is NOT the disputer.
 *
 *   state === 'MarkDisputed'   → Agree (bilateral resolve) + Escalate (operator)
 *   state === 'Escalated'      → read-only "awaiting operator" pill
 *   active party IS the disputer → render nothing
 *
 * The disputer side has no actions here: they're waiting for the
 * counterparty to either Agree or Escalate. The operator drives
 * resolution from `Escalated` via `CsaOperatorActions`.
 */
export function DisputeCounterpartyActions({
  csaCid,
  pairPartyA,
  pairPartyB,
  party,
  disputer,
  counterMark,
  reason,
  notes,
  ccy,
  state,
}: DisputeCounterpartyActionsProps) {
  const { client } = useLedgerClient()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [agreeOpen, setAgreeOpen] = useState(false)

  const resolveFreshCid = useMemo(
    () => (client ? makeCsaPairResolver(client, pairPartyA, pairPartyB) : undefined),
    [client, pairPartyA, pairPartyB],
  )

  // Hide entirely when active party opened the dispute, or when state has
  // already left the dispute window (Active / MarginCallOutstanding).
  if (party === disputer) return null
  if (state !== 'MarkDisputed' && state !== 'Escalated') return null

  if (state === 'Escalated') {
    return (
      <div
        data-testid="dispute-counterparty-escalated-pill"
        className="rounded border border-rose-700/40 bg-rose-900/20 px-3 py-1.5 text-[11px] text-rose-200"
      >
        Escalated — awaiting operator
      </div>
    )
  }

  const handleAgree = async () => {
    if (!client) return
    setError(null)
    setBusy(true)
    try {
      await agreeToCounterMark(
        client,
        csaCid,
        party,
        new Date().toISOString(),
        '{}',
        resolveFreshCid,
      )
      void queryClient.invalidateQueries({ queryKey: ['csas'] })
      setAgreeOpen(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Agree failed')
    } finally {
      setBusy(false)
    }
  }

  const handleEscalate = async () => {
    if (!client) return
    setError(null)
    setBusy(true)
    try {
      await escalateDispute(client, csaCid, party, resolveFreshCid)
      void queryClient.invalidateQueries({ queryKey: ['csas'] })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Escalate failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button
          data-testid="dispute-counterparty-agree"
          disabled={busy}
          onClick={() => setAgreeOpen(true)}
          className="rounded bg-emerald-700 px-3 py-1.5 text-[11px] text-white disabled:opacity-40"
        >
          Agree
        </button>
        <button
          data-testid="dispute-counterparty-escalate"
          disabled={busy}
          onClick={handleEscalate}
          className="rounded bg-rose-700 px-3 py-1.5 text-[11px] text-white disabled:opacity-40"
        >
          Escalate
        </button>
      </div>
      {error && <div className="text-[10px] text-rose-400">{error}</div>}
      {agreeOpen && (
        <div
          role="dialog"
          aria-label="Confirm agree"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        >
          <div className="w-[420px] rounded border border-[#1e2235] bg-[#111320] p-5 text-white">
            <h2 className="mb-3 text-sm font-semibold tracking-wider">CONFIRM AGREE</h2>
            <p className="mb-3 text-[11px] text-zinc-400">
              Accept the counter mark of{' '}
              <span className="font-mono text-emerald-300">{fmtCcy(counterMark, ccy)}</span>{' '}
              proposed by the disputer? This stamps the new mark and flips the CSA back to Active.
            </p>
            <div className="mb-3 rounded border border-[#1e2235] bg-[#0b0d18] px-2 py-1 text-[11px]">
              <div className="text-zinc-500">
                Reason: <span className="text-zinc-300">{reason}</span>
              </div>
              {notes && (
                <div className="mt-1 text-zinc-500">
                  Notes: <span className="text-zinc-300">{notes}</span>
                </div>
              )}
            </div>
            {error && <p className="mb-3 text-[11px] text-red-400">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setAgreeOpen(false)}
                disabled={busy}
                className="px-3 py-1.5 text-[11px] text-zinc-500 hover:text-zinc-300"
              >
                Cancel
              </button>
              <button
                onClick={handleAgree}
                disabled={busy}
                data-testid="dispute-counterparty-agree-confirm"
                className="rounded bg-emerald-600 px-3 py-1.5 text-[11px] text-white hover:bg-emerald-500 disabled:opacity-40"
              >
                {busy ? '…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
