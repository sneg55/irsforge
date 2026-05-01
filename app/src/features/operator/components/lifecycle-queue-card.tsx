'use client'

import Link from 'next/link'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import type { SwapFamily } from '@/shared/config/client'
import { ROUTES } from '@/shared/constants/routes'
import { useLedger } from '@/shared/contexts/ledger-context'
import { useOperatorPolicies } from '../hooks/use-operator-policies'
import { useOperatorQueueStream } from '../hooks/use-operator-queue-stream'
import { QueueRow } from './queue-row'

const ALL_FAMILIES: readonly SwapFamily[] = [
  'IRS',
  'OIS',
  'BASIS',
  'XCCY',
  'CDS',
  'CCY',
  'FX',
  'ASSET',
  'FpML',
] as const

const FAMILIES_TOOLTIP =
  'Swap families: IRS · OIS · BASIS · XCCY · CDS · CCY · FX · ASSET · FpML. Each family has an independent operator policy.'
const CO_SIGN_TOOLTIP =
  'Co-sign means the operator must counter-sign a trader proposal before it executes. Auto-policy bypasses co-sign; manual-policy routes the proposal here for review.'

function EmptyQueueState() {
  const { rows } = useOperatorPolicies()
  const policyMap = new Map(rows.map((r) => [r.family, r.mode] as const))
  const autoCount = ALL_FAMILIES.filter((f) => (policyMap.get(f) ?? 'auto') === 'auto').length
  const manualCount = ALL_FAMILIES.length - autoCount
  return (
    <div className="px-6 py-8 text-center" data-testid="operator-queue-empty">
      <p className="text-sm text-zinc-500">No pending actions</p>
      <p className="mt-2 text-xs text-zinc-600">
        {manualCount === 0 ? (
          <>
            All {autoCount}{' '}
            <span className="underline decoration-dotted" title={FAMILIES_TOOLTIP}>
              families
            </span>{' '}
            on auto-policy · proposals don&apos;t need{' '}
            <span className="underline decoration-dotted" title={CO_SIGN_TOOLTIP}>
              co-sign
            </span>
          </>
        ) : (
          <>
            {autoCount} auto · {manualCount} manual · queue activates when a manual-policy proposal
            is routed for review
          </>
        )}
      </p>
    </div>
  )
}

function CsaDisputeRow({ disputeCount }: { disputeCount: number }) {
  const { activeOrg } = useLedger()
  const orgId = activeOrg?.id ?? ''
  const csaHref = orgId ? ROUTES.ORG_CSA(orgId) : '#'
  const hasDisputes = disputeCount > 0
  return (
    <div
      data-testid="csa-dispute-row"
      className="flex items-center justify-between border-t border-zinc-800/50 px-6 py-3 text-xs"
    >
      <span className="flex items-center gap-2">
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${
            hasDisputes ? 'bg-red-400' : 'bg-emerald-500/60'
          }`}
        />
        <span className="text-zinc-400">CSA disputes</span>
        <span
          className={`font-mono ${hasDisputes ? 'text-red-300' : 'text-zinc-500'}`}
          data-testid="csa-dispute-count"
        >
          {disputeCount}
        </span>
      </span>
      <Link
        href={csaHref}
        className="text-zinc-500 hover:text-zinc-300 underline decoration-dotted"
      >
        View CSAs
      </Link>
    </div>
  )
}

function QueueSkeletonRow() {
  return (
    <div
      data-slot="queue-skeleton-row"
      className="flex items-center gap-4 px-6 py-3 border-b border-zinc-800/50"
    >
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-4 w-20" />
      <div className="ml-auto">
        <Skeleton className="h-7 w-20" />
      </div>
    </div>
  )
}

export function LifecycleQueueCard() {
  const { items, isLoading, isError, error, refetch } = useOperatorQueueStream()
  const disputeCount = items.filter((i) => i.type === 'dispute').length

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Operator queue
        </h2>
        {!isLoading && !isError && (
          <span className="text-xs text-zinc-500">
            {items.length} item{items.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="py-2">
        {isError ? (
          <div className="px-6 py-4">
            <ErrorState error={error} onRetry={refetch} retryLabel="Retry queue" />
          </div>
        ) : isLoading ? (
          <>
            {Array.from({ length: 4 }, (_, i) => (
              <QueueSkeletonRow key={i} />
            ))}
          </>
        ) : items.length === 0 ? (
          <EmptyQueueState />
        ) : (
          <div role="table" className="divide-y divide-zinc-800/50">
            {items.map((item) => (
              <QueueRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>

      {!isLoading && !isError && <CsaDisputeRow disputeCount={disputeCount} />}
    </div>
  )
}
