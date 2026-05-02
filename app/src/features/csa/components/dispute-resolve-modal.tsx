'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useLedgerClient } from '@/shared/hooks/use-ledger-client'
import type { CsaState } from '@/shared/ledger/csa-types'
import { acknowledgeDispute, makeCsaPairResolver } from '../ledger/csa-actions'

interface Props {
  csaCid: string
  pairPartyA: string
  pairPartyB: string
  ccy: string
  /** Optional: current exposure from the latest mark observation, used
   *  as the default re-publish value. If unknown (e.g. called from the
   *  operator queue without a mark stream), default to 0 and let the
   *  operator enter a value explicitly. */
  currentExposure: number | null
  /** CSA state — drives the heading copy ("RESOLVE DISPUTE" vs
   *  "RESOLVE ESCALATED DISPUTE"). Defaults to MarkDisputed when the
   *  caller doesn't disambiguate. */
  state?: CsaState
  onClose: () => void
  onResolved?: () => void
}

const fmtCcy = (n: number, ccy: string) =>
  n.toLocaleString('en-US', { style: 'currency', currency: ccy, maximumFractionDigits: 0 })

/**
 * Shared modal for CSA dispute adjudication. Used in two places:
 *   - CSA drawer (`CsaOperatorActions`), opened from /csa page
 *   - Operator queue row (`QueueRow`), opened inline without navigation
 * Keeps the acknowledgeDispute exercise + query invalidation path in one
 * place so both callers produce identical on-chain effects.
 */
export function DisputeResolveModal({
  csaCid,
  pairPartyA,
  pairPartyB,
  ccy,
  currentExposure,
  state = 'MarkDisputed',
  onClose,
  onResolved,
}: Props) {
  const { client } = useLedgerClient()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exposureText, setExposureText] = useState(
    currentExposure === null ? '0' : currentExposure.toString(),
  )

  const resolveFreshCid = useMemo(
    () => (client ? makeCsaPairResolver(client, pairPartyA, pairPartyB) : undefined),
    [client, pairPartyA, pairPartyB],
  )

  useEffect(() => {
    setExposureText(currentExposure === null ? '0' : currentExposure.toString())
  }, [currentExposure])

  const handleResolve = async () => {
    if (!client) return
    const n = Number(exposureText)
    if (!Number.isFinite(n)) {
      setError('Exposure must be a number')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await acknowledgeDispute(
        client,
        csaCid,
        new Date().toISOString(),
        n,
        'operator-ack',
        resolveFreshCid,
      )
      void queryClient.invalidateQueries({ queryKey: ['csas'] })
      onResolved?.()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Resolve failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-label="Resolve dispute"
      data-testid="dispute-resolve-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div className="w-[460px] rounded border border-[#1e2235] bg-[#111320] p-5 text-white">
        <h2 className="mb-1 text-sm font-semibold tracking-wider">
          {state === 'Escalated' ? 'RESOLVE ESCALATED DISPUTE' : 'RESOLVE DISPUTE'}
        </h2>
        <p className="mb-4 text-2xs text-zinc-500">
          Publishes a new mark and flips state back to Active. The value below is the mark the
          operator is attesting to.
        </p>
        <label htmlFor="ack-exposure" className="mb-1 block text-2xs text-zinc-500">
          New exposure ({ccy}){' '}
          {currentExposure !== null && (
            <span className="text-zinc-600">· latest stream {fmtCcy(currentExposure, ccy)}</span>
          )}
        </label>
        <input
          id="ack-exposure"
          type="text"
          inputMode="decimal"
          autoFocus
          value={exposureText}
          onChange={(e) => setExposureText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !busy) void handleResolve()
          }}
          className="mb-3 w-full rounded border border-[#1e2235] bg-transparent px-2 py-1 font-mono text-sm focus:border-zinc-500 outline-hidden"
        />
        {error && <p className="mb-3 text-2xs text-red-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="px-3 py-1.5 text-2xs text-zinc-500 hover:text-zinc-300"
          >
            Cancel
          </button>
          <button
            data-testid="dispute-resolve-confirm"
            onClick={handleResolve}
            disabled={busy}
            className="rounded bg-indigo-600 px-3 py-1.5 text-2xs text-white hover:bg-indigo-500 disabled:opacity-40"
          >
            {busy ? '…' : 'Resolve'}
          </button>
        </div>
      </div>
    </div>
  )
}
