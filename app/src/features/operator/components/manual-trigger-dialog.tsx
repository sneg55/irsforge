'use client'

import { useMutation } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useLedgerClient } from '@/shared/hooks/use-ledger-client'
import { manualTriggerLifecycle } from '../ledger/manual-lifecycle'

interface Props {
  open: boolean
  onClose: () => void
  /** When set, the dialog opens with this cid prefilled and read-only (with a
   * "Change" link to fall back to free entry). Empty string = free entry. */
  defaultSwapCid?: string
}

export function ManualTriggerDialog({ open, onClose, defaultSwapCid = '' }: Props) {
  const { client } = useLedgerClient()
  const [swapCid, setSwapCid] = useState(defaultSwapCid)
  const [locked, setLocked] = useState(defaultSwapCid.length > 0)
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0])

  // When the parent supplies a new defaultSwapCid (e.g. operator clicks a
  // different row in the picker), reset the local state to match.
  useEffect(() => {
    if (!open) return
    setSwapCid(defaultSwapCid)
    setLocked(defaultSwapCid.length > 0)
  }, [open, defaultSwapCid])

  const mutation = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error('No ledger client')
      await manualTriggerLifecycle(client, {
        swapContractId: swapCid.trim(),
        eventDate: eventDate.trim(),
      })
    },
    onSuccess: () => {
      setSwapCid('')
      onClose()
    },
  })

  if (!open) return null

  const canSubmit = swapCid.trim().length > 0 && eventDate.trim().length > 0

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="manual-trigger-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
    >
      <div className="w-full max-w-md rounded-lg border border-zinc-700 bg-zinc-900 p-6 shadow-xl">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-300">
          Publish fixing manually
        </h3>

        {mutation.isError && (
          <p className="mb-3 text-xs text-red-400">
            {mutation.error instanceof Error ? mutation.error.message : 'Unknown error'}
          </p>
        )}

        <div className="space-y-3">
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="block text-xs text-zinc-400">Swap workflow contract ID</label>
              {locked && (
                <button
                  type="button"
                  data-testid="manual-trigger-change-cid"
                  className="text-xs text-zinc-500 underline decoration-dotted hover:text-zinc-300"
                  onClick={() => setLocked(false)}
                >
                  Change
                </button>
              )}
            </div>
            {locked ? (
              <p
                data-testid="manual-trigger-cid-readonly"
                className="break-all rounded border border-zinc-800 bg-zinc-950 px-3 py-1.5 font-mono text-xs text-zinc-300"
              >
                {swapCid}
              </p>
            ) : (
              <input
                data-testid="manual-trigger-swap-cid"
                className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 font-mono text-xs text-zinc-100 placeholder-zinc-600 focus:border-zinc-500 focus:outline-hidden"
                placeholder="abc123::fingerprint"
                value={swapCid}
                onChange={(e) => setSwapCid(e.target.value)}
              />
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs text-zinc-400">Event date (YYYY-MM-DD)</label>
            <input
              data-testid="manual-trigger-event-date"
              type="date"
              className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 font-mono text-sm text-zinc-100 focus:border-zinc-500 focus:outline-hidden"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
          </div>
        </div>

        <p className="mt-3 text-xs text-zinc-500">
          Note: Only suitable for CCY/FX/FpML families. IRS/CDS require observation resolution via
          the workspace trigger flow.
        </p>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            className="rounded px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-100"
            onClick={() => {
              setSwapCid('')
              onClose()
            }}
          >
            Cancel
          </button>
          <button
            data-testid="manual-trigger-submit"
            type="button"
            disabled={!canSubmit || mutation.isPending}
            className="rounded bg-orange-700 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40 hover:bg-orange-600"
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Triggering…' : 'Trigger lifecycle'}
          </button>
        </div>
      </div>
    </div>
  )
}
