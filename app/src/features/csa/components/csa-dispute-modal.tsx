'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useLedgerClient } from '@/shared/hooks/use-ledger-client'
import type { DisputeReason } from '@/shared/ledger/csa-types'
import { dispute, makeCsaPairResolver } from '../ledger/csa-actions'

interface Props {
  isOpen: boolean
  onClose: () => void
  csaCid: string
  /** Party A of the CSA pair — stable identity across cid rotation. */
  pairPartyA: string
  /** Party B of the CSA pair — stable identity across cid rotation. */
  pairPartyB: string
  party: string
  currentExposure: number | null
}

const REASON_OPTIONS: { value: DisputeReason; label: string }[] = [
  { value: 'Valuation', label: 'Valuation (mark-to-market)' },
  { value: 'Collateral', label: 'Eligible collateral' },
  { value: 'FxRate', label: 'FX rate' },
  { value: 'Threshold', label: 'Threshold / MTA' },
  { value: 'IndependentAmount', label: 'Independent amount' },
  { value: 'Other', label: 'Other' },
]

export function CsaDisputeModal({
  isOpen,
  onClose,
  csaCid,
  pairPartyA,
  pairPartyB,
  party,
  currentExposure,
}: Props) {
  const { client } = useLedgerClient()
  const queryClient = useQueryClient()
  const resolveFreshCid = useMemo(
    () => (client ? makeCsaPairResolver(client, pairPartyA, pairPartyB) : undefined),
    [client, pairPartyA, pairPartyB],
  )
  const [counterMark, setCounterMark] = useState<string>(
    currentExposure !== null ? (currentExposure * 0.9).toFixed(2) : '0',
  )
  const [reason, setReason] = useState<DisputeReason>('Valuation')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setCounterMark(currentExposure !== null ? (currentExposure * 0.9).toFixed(2) : '0')
      setReason('Valuation')
      setNotes('')
      setError(null)
    }
  }, [isOpen, currentExposure])

  if (!isOpen) return null

  const handleSubmit = async () => {
    if (!client) return
    const n = Number(counterMark)
    if (!Number.isFinite(n)) {
      setError('Counter mark must be a number')
      return
    }
    setError(null)
    setBusy(true)
    try {
      await dispute(client, csaCid, party, n, reason, notes.trim(), resolveFreshCid)
      void queryClient.invalidateQueries({ queryKey: ['csas'] })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Dispute failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-label="Dispute mark"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
    >
      <div className="w-[420px] bg-[#111320] border border-[#1e2235] rounded p-5 text-white">
        <h2 className="text-sm font-semibold tracking-wider mb-4">DISPUTE MARK</h2>
        <label htmlFor="dispute-counter-mark" className="block text-2xs text-[#555b6e] mb-1">
          Counter mark (valuation ccy)
        </label>
        <input
          id="dispute-counter-mark"
          aria-label="Counter mark"
          type="text"
          value={counterMark}
          onChange={(e) => setCounterMark(e.target.value)}
          className="w-full bg-transparent border border-[#1e2235] px-2 py-1 text-sm font-mono mb-3"
        />
        <label htmlFor="dispute-reason" className="block text-2xs text-[#555b6e] mb-1">
          Reason
        </label>
        <select
          id="dispute-reason"
          aria-label="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value as DisputeReason)}
          className="w-full bg-[#0b0d18] border border-[#1e2235] px-2 py-1 text-sm mb-3"
        >
          {REASON_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <label htmlFor="dispute-notes" className="block text-2xs text-[#555b6e] mb-1">
          Notes (optional)
        </label>
        <textarea
          id="dispute-notes"
          aria-label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full bg-transparent border border-[#1e2235] px-2 py-1 text-sm mb-3"
        />
        {error && <p className="text-2xs text-red-400 mb-3">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            disabled={busy}
            className="px-3 py-1.5 text-2xs text-[#555b6e] hover:text-[#8b8fa3]"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={busy || !client}
            className="px-3 py-1.5 text-2xs rounded bg-amber-600 text-white disabled:opacity-40"
          >
            Dispute
          </button>
        </div>
      </div>
    </div>
  )
}
