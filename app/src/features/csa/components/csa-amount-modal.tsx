'use client'

import { useEffect, useState } from 'react'

export type CsaAmountMode = 'post' | 'withdraw'

interface Props {
  isOpen: boolean
  mode: CsaAmountMode
  ccy: string
  max?: number
  /**
   * Pre-fill value for the Amount field at open time. In post mode this is
   * typically the outstanding margin call directed at the active party so
   * the user doesn't have to retype the figure they're already looking at.
   * Ignored when ≤ 0; only consulted at open time so user edits aren't
   * clobbered when the underlying mark stream ticks.
   */
  prefillAmount?: number | null
  onClose: () => void
  onSubmit: (amount: number) => Promise<void>
}

const fmt = (n: number, ccy = 'USD') =>
  n.toLocaleString('en-US', { style: 'currency', currency: ccy, maximumFractionDigits: 0 })

const CONFIG = {
  post: {
    title: 'POST COLLATERAL',
    label: 'Amount',
    submit: 'Post',
    submitClass: 'bg-emerald-600 hover:bg-emerald-500',
    defaultAmount: '1000000',
  },
  withdraw: {
    title: 'WITHDRAW COLLATERAL',
    label: 'Amount',
    submit: 'Withdraw',
    submitClass: 'bg-zinc-700 hover:bg-zinc-600',
    defaultAmount: '0',
  },
} as const

function initialAmountText(mode: CsaAmountMode, prefillAmount: number | null | undefined): string {
  if (mode === 'post' && prefillAmount && prefillAmount > 0) {
    return String(prefillAmount)
  }
  return CONFIG[mode].defaultAmount
}

export function CsaAmountModal({
  isOpen,
  mode,
  ccy,
  max,
  prefillAmount,
  onClose,
  onSubmit,
}: Props) {
  const cfg = CONFIG[mode]
  const [amountText, setAmountText] = useState<string>(() => initialAmountText(mode, prefillAmount))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setAmountText(initialAmountText(mode, prefillAmount))
      setError(null)
      setBusy(false)
    }
    // Intentionally only re-run on open transitions; subsequent prefill
    // changes mid-modal would clobber a user's manual edit.
     
  }, [isOpen])

  if (!isOpen) return null

  const handleSubmit = async () => {
    const n = Number(amountText)
    if (!Number.isFinite(n) || n <= 0) {
      setError('Amount must be a positive number')
      return
    }
    if (mode === 'withdraw' && max !== undefined && n > max) {
      setError(`Cannot withdraw above posted balance (${fmt(max)})`)
      return
    }
    setError(null)
    setBusy(true)
    try {
      await onSubmit(n)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : `${cfg.submit} failed`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-label={cfg.title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose()
      }}
    >
      <div className="w-[420px] rounded border border-[#1e2235] bg-[#111320] p-5 text-white">
        <h2 className="mb-4 text-sm font-semibold tracking-wider">{cfg.title}</h2>
        <label htmlFor="csa-amount" className="mb-1 block text-2xs text-[#555b6e]">
          {cfg.label} ({ccy})
        </label>
        <input
          id="csa-amount"
          aria-label={cfg.label}
          type="text"
          inputMode="decimal"
          autoFocus
          value={amountText}
          onChange={(e) => setAmountText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !busy) void handleSubmit()
          }}
          className="mb-3 w-full rounded border border-[#1e2235] bg-transparent px-2 py-1 font-mono text-sm focus:border-zinc-500 outline-hidden"
        />
        {mode === 'post' && prefillAmount && prefillAmount > 0 && (
          <div
            className="mb-3 flex items-center justify-between text-2xs"
            data-testid="csa-amount-prefill-hint"
          >
            <span className="text-[#555b6e]">
              Outstanding margin call:{' '}
              <span className="text-emerald-300">{fmt(prefillAmount, ccy)}</span>
            </span>
            {amountText !== String(prefillAmount) && (
              <button
                type="button"
                onClick={() => setAmountText(String(prefillAmount))}
                className="text-2xs text-blue-400 hover:text-blue-300"
              >
                Use call amount
              </button>
            )}
          </div>
        )}
        {mode === 'withdraw' && max !== undefined && (
          <div className="mb-3 flex items-center justify-between text-2xs">
            <span className="text-[#555b6e]">
              Posted balance: <span className="text-zinc-300">{fmt(max)}</span>
            </span>
            <button
              type="button"
              onClick={() => setAmountText(String(max))}
              className="text-2xs text-blue-400 hover:text-blue-300"
            >
              Max
            </button>
          </div>
        )}
        {error && <p className="mb-3 text-2xs text-red-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="px-3 py-1.5 text-2xs text-[#555b6e] hover:text-[#8b8fa3]"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={busy}
            className={`rounded px-3 py-1.5 text-2xs text-white disabled:opacity-40 ${cfg.submitClass}`}
          >
            {busy ? '…' : cfg.submit}
          </button>
        </div>
      </div>
    </div>
  )
}
