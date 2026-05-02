'use client'

import { PartyName } from 'canton-party-directory/ui'
import type { OperatorQueueItem } from '../hooks/use-operator-queue'

interface Props {
  item: OperatorQueueItem | null
  isSigning: boolean
  error: string | null
  onConfirm: () => void
  onClose: () => void
}

/**
 * Modal shown before the operator co-signs an AcceptAck contract. Lets
 * the operator verify proposer / counterparty / family / proposal cid
 * before the signature lands on-chain — the signing ceremony should
 * never be a one-click affair without a payload preview.
 */
export function CoSignPreviewModal({ item, isSigning, error, onConfirm, onClose }: Props) {
  if (!item || item.type !== 'accept-ack') return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="co-sign-preview-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
    >
      <div className="w-full max-w-md rounded-lg border border-zinc-700 bg-zinc-900 p-6 shadow-xl">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-300">
          Co-sign {item.family} AcceptAck
        </h3>

        <dl className="space-y-2 text-xs">
          <div className="grid grid-cols-3 gap-2">
            <dt className="text-zinc-500">Family</dt>
            <dd className="col-span-2 font-mono text-zinc-200">{item.family}</dd>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <dt className="text-zinc-500">Proposer</dt>
            <dd className="col-span-2 text-zinc-200">
              {item.proposer ? <PartyName identifier={item.proposer} /> : '—'}
            </dd>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <dt className="text-zinc-500">Counterparty</dt>
            <dd className="col-span-2 text-zinc-200">
              {item.counterparty ? <PartyName identifier={item.counterparty} /> : '—'}
            </dd>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <dt className="text-zinc-500">Proposal cid</dt>
            <dd
              className="col-span-2 break-all font-mono text-2xs text-zinc-400"
              data-testid="co-sign-proposal-cid"
            >
              {item.proposalCid ?? '—'}
            </dd>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <dt className="text-zinc-500">AcceptAck cid</dt>
            <dd className="col-span-2 break-all font-mono text-2xs text-zinc-400">
              {item.contractId ?? '—'}
            </dd>
          </div>
        </dl>

        <p className="mt-4 text-xs text-zinc-500">
          Co-signing completes the proposal — operator signature authorises the Factory.Create that
          materialises the instrument and workflow.
        </p>

        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSigning}
            className="rounded px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-100 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            data-testid="co-sign-confirm"
            onClick={onConfirm}
            disabled={isSigning}
            className="rounded bg-amber-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-40"
          >
            {isSigning ? 'Signing…' : 'Sign'}
          </button>
        </div>
      </div>
    </div>
  )
}
