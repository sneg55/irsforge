'use client'

import { PartyName } from 'canton-party-directory/ui'
import { useEffect } from 'react'
import { STATUS_COLORS } from './constants'
import type { SwapRow } from './types'

interface Props {
  row: SwapRow | null
  onClose: () => void
}

function formatCurrency(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

function SignedAmount({ amount }: { amount: number }) {
  const cls = amount >= 0 ? 'text-green-400' : 'text-red-400'
  return <span className={`font-mono ${cls}`}>{formatCurrency(amount)}</span>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-xs uppercase tracking-wide text-zinc-500">{label}</span>
      <span className="text-sm text-zinc-200">{children}</span>
    </div>
  )
}

function BatchCidLine({ cid }: { cid: string | null | undefined }) {
  if (!cid) return <span className="text-zinc-500 italic">No cash settlement</span>
  const copy = () => {
    void navigator.clipboard?.writeText(cid)
  }
  return (
    <span className="flex items-center gap-2">
      <span className="font-mono text-xs text-zinc-300 break-all" title={cid}>
        {cid}
      </span>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-3xs text-zinc-400 hover:bg-zinc-700"
      >
        Copy
      </button>
    </span>
  )
}

export function RowDetailsDrawer({ row, onClose }: Props) {
  useEffect(() => {
    if (!row) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [row, onClose])

  if (!row) return null

  const statusColor = STATUS_COLORS[row.status] ?? 'text-zinc-400'
  const isMatured = row.status === 'Matured'
  const isUnwound = row.status === 'Unwound'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${row.status} swap details`}
      className="fixed inset-0 z-40"
    >
      <div
        data-testid="row-details-backdrop"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col gap-4 overflow-y-auto border-l border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
        <header className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-3">
            <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs font-semibold text-zinc-200">
              {row.type}
            </span>
            <PartyName identifier={row.counterparty} />
            <span className={`text-xs font-medium ${statusColor}`}>{row.status}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="text-zinc-500 hover:text-zinc-200"
          >
            ×
          </button>
        </header>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Trade
          </h3>
          <Field label="Notional">
            <span className="font-mono">{formatCurrency(row.notional)}</span>
          </Field>
          <Field label="Currency">{row.currency}</Field>
          <Field label="Scheduled Maturity">{row.maturity}</Field>
          <Field label="Direction">
            <span className={row.direction === 'pay' ? 'text-red-400' : 'text-green-400'}>
              {row.direction === 'pay' ? 'Pay' : 'Receive'}
            </span>
          </Field>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Close-out
          </h3>
          {isMatured && (
            <>
              <Field label="Actual Maturity">{row.terminalDate ?? '—'}</Field>
              <Field label="Final Net">
                {row.terminalAmount !== undefined ? (
                  <SignedAmount amount={row.terminalAmount} />
                ) : (
                  '—'
                )}
              </Field>
              <Field label="Settlement Batch">
                <BatchCidLine cid={row.settleBatchCid} />
              </Field>
            </>
          )}
          {isUnwound && (
            <>
              <Field label="Termination Date">{row.terminalDate ?? '—'}</Field>
              <Field label="Agreed PV">
                {row.terminalAmount !== undefined ? (
                  <SignedAmount amount={row.terminalAmount} />
                ) : (
                  '—'
                )}
              </Field>
              <Field label="Reason">{row.reason ?? '—'}</Field>
              <Field label="Terminated By">
                {row.terminatedByParty ? <PartyName identifier={row.terminatedByParty} /> : '—'}
              </Field>
              <Field label="Settlement Batch">
                <BatchCidLine cid={row.settleBatchCid} />
              </Field>
            </>
          )}
        </section>
      </aside>
    </div>
  )
}
