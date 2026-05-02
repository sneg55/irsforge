'use client'

import { useEffect, useState } from 'react'

export interface UnwindModalProps {
  isOpen: boolean
  onClose: () => void
  currentNpv: number
  onSubmit: (pvAmount: number, reason: string) => Promise<void>
}

export function UnwindModal({ isOpen, onClose, currentNpv, onSubmit }: UnwindModalProps) {
  const [pvText, setPvText] = useState(currentNpv.toFixed(2))
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [inFlight, setInFlight] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setPvText(currentNpv.toFixed(2))
      setReason('')
      setError(null)
    }
  }, [isOpen, currentNpv])

  if (!isOpen) return null

  const handleSubmit = async () => {
    setError(null)
    const pv = Number(pvText)
    if (!Number.isFinite(pv)) {
      setError('PV must be a number')
      return
    }
    if (reason.trim() === '') {
      setError('Reason is required')
      return
    }
    setInFlight(true)
    try {
      await onSubmit(pv, reason.trim())
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed')
    } finally {
      setInFlight(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-[420px] bg-[#111320] border border-[#1e2235] rounded p-5 text-white">
        <h2 className="text-sm font-semibold tracking-wider mb-4">UNWIND SWAP</h2>
        <label className="block text-2xs text-[#555b6e] mb-1" htmlFor="unwind-pv">
          PV Amount (USD)
        </label>
        <input
          id="unwind-pv"
          aria-label="PV Amount"
          type="text"
          value={pvText}
          onChange={(e) => setPvText(e.target.value)}
          className="w-full bg-transparent border border-[#1e2235] px-2 py-1 text-sm font-mono mb-1"
        />
        <p className="text-[9px] text-[#555b6e] mb-3">
          Positive: you pay counterparty. Negative: counterparty pays you.
        </p>
        <label className="block text-2xs text-[#555b6e] mb-1" htmlFor="unwind-reason">
          Reason
        </label>
        <textarea
          id="unwind-reason"
          aria-label="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="w-full bg-transparent border border-[#1e2235] px-2 py-1 text-sm mb-3"
        />
        {error && <p className="text-2xs text-red-400 mb-3">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            disabled={inFlight}
            className="px-3 py-1.5 text-2xs text-[#555b6e] hover:text-[#8b8fa3]"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={inFlight}
            className="px-3 py-1.5 text-2xs bg-[#8b5cf6] rounded disabled:opacity-50"
          >
            {inFlight ? 'Submitting…' : 'Submit Unwind'}
          </button>
        </div>
      </div>
    </div>
  )
}
