'use client'

import { useMutation } from '@tanstack/react-query'
import { PartyName } from 'canton-party-directory/ui'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { DisputeResolveModal } from '@/features/csa/components/dispute-resolve-modal'
import { useLedgerClient } from '@/shared/hooks/use-ledger-client'
import type { OperatorQueueItem } from '../hooks/use-operator-queue'
import { confirmAccept } from '../ledger/confirm-accept'
import { CoSignPreviewModal } from './co-sign-preview-modal'

// Render the item title with PartyName-resolved party identifiers when the
// raw fields are present; fall back to the hook-built title string for
// items the queue doesn't carry party metadata on (e.g. lifecycle ticks).
// The title prop on the item is still useful for sorting / aria / fallbacks
// — we just don't render the bare hint strings the hook composed.
function QueueRowTitle({ item }: { item: OperatorQueueItem }) {
  if (item.type === 'dispute' && item.csaPartyA && item.csaPartyB) {
    return (
      <>
        CSA <PartyName identifier={item.csaPartyA} />–
        <PartyName identifier={item.csaPartyB} />: dispute
      </>
    )
  }
  if (item.type === 'accept-ack' && item.family && item.proposer && item.counterparty) {
    return (
      <>
        {item.family} proposal — <PartyName identifier={item.proposer} /> →{' '}
        <PartyName identifier={item.counterparty} />: awaiting co-sign
      </>
    )
  }
  return <>{item.title}</>
}

const TYPE_BADGE_CLASS: Record<string, string> = {
  dispute: 'bg-red-900 text-red-300',
  'accept-ack': 'bg-amber-900 text-amber-300',
  lifecycle: 'bg-blue-900 text-blue-300',
}

const TYPE_LABEL: Record<string, string> = {
  dispute: 'Dispute',
  'accept-ack': 'Co-sign',
  lifecycle: 'Lifecycle',
}

interface QueueRowProps {
  item: OperatorQueueItem
}

export function QueueRow({ item }: QueueRowProps) {
  const router = useRouter()
  const { client } = useLedgerClient()
  const [previewOpen, setPreviewOpen] = useState(false)
  const [disputeOpen, setDisputeOpen] = useState(false)

  const coSignMutation = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error('No ledger client')
      if (!item.family || !item.contractId) throw new Error('Missing accept-ack metadata')
      await confirmAccept(client, { family: item.family, ackContractId: item.contractId })
    },
    onSuccess: () => {
      setPreviewOpen(false)
    },
  })

  const badgeClass = TYPE_BADGE_CLASS[item.type] ?? 'bg-zinc-800 text-zinc-400'
  const badgeLabel = TYPE_LABEL[item.type] ?? item.type

  function handleRowClick() {
    router.push(item.deepLinkHref)
  }

  function handleCoSignOpen(e: React.MouseEvent) {
    e.stopPropagation()
    coSignMutation.reset()
    setPreviewOpen(true)
  }

  function handleResolveOpen(e: React.MouseEvent) {
    e.stopPropagation()
    setDisputeOpen(true)
  }

  const previewError = coSignMutation.isError
    ? coSignMutation.error instanceof Error
      ? coSignMutation.error.message
      : 'Co-sign failed'
    : null

  return (
    <>
      <div
        role="row"
        onClick={handleRowClick}
        className="flex cursor-pointer items-start justify-between gap-4 rounded-md px-4 py-3 hover:bg-zinc-800 transition-colors"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${badgeClass}`}>
              {badgeLabel}
            </span>
            <span className="truncate font-mono text-sm text-zinc-100">
              <QueueRowTitle item={item} />
            </span>
          </div>
          <p className="mt-0.5 text-xs text-zinc-500">{item.subtitle}</p>
        </div>

        {item.type === 'accept-ack' && (
          <button
            type="button"
            data-testid={`co-sign-${item.contractId?.slice(0, 12) ?? 'x'}`}
            onClick={handleCoSignOpen}
            className="shrink-0 rounded border border-amber-700 px-3 py-1 text-xs font-medium text-amber-300 hover:bg-amber-900 transition-colors"
          >
            Co-sign
          </button>
        )}

        {item.type === 'dispute' && item.csaContractId && (
          <button
            type="button"
            data-testid={`resolve-${item.csaContractId.slice(0, 12)}`}
            onClick={handleResolveOpen}
            className="shrink-0 rounded border border-red-800 px-3 py-1 text-xs font-medium text-red-300 hover:bg-red-900 transition-colors"
          >
            Resolve
          </button>
        )}
      </div>

      {item.type === 'accept-ack' && previewOpen && (
        <CoSignPreviewModal
          item={item}
          isSigning={coSignMutation.isPending}
          error={previewError}
          onConfirm={() => coSignMutation.mutate()}
          onClose={() => setPreviewOpen(false)}
        />
      )}

      {item.type === 'dispute' &&
        disputeOpen &&
        item.csaContractId &&
        item.csaPartyA &&
        item.csaPartyB &&
        item.csaCcy && (
          <DisputeResolveModal
            csaCid={item.csaContractId}
            pairPartyA={item.csaPartyA}
            pairPartyB={item.csaPartyB}
            ccy={item.csaCcy}
            currentExposure={null}
            onClose={() => setDisputeOpen(false)}
          />
        )}
    </>
  )
}
