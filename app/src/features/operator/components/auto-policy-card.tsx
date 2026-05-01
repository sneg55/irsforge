'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton } from '@/components/ui/skeleton'
import type { OperatorPolicyMode, SwapFamily } from '@/shared/config/client'
import { useActiveOrgRole } from '@/shared/hooks/use-active-org-role'
import { useLedgerClient } from '@/shared/hooks/use-ledger-client'
import {
  OPERATOR_POLICIES_QUERY_KEY,
  type OperatorPolicyRow,
  useOperatorPolicies,
} from '../hooks/use-operator-policies'
import { setOperatorPolicyMode } from '../ledger/set-policy-mode'

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

const CARD_TITLE = 'Auto-policy'
const CARD_HINT =
  'Auto = Accept routes traders straight to a live swap. Manual = Accept routes through ProposeAccept and waits for operator co-sign in this queue.'

interface ToggleRowProps {
  family: SwapFamily
  row: OperatorPolicyRow | undefined
  canEdit: boolean
  pendingFamily: SwapFamily | null
  onToggle: (family: SwapFamily, row: OperatorPolicyRow, next: OperatorPolicyMode) => void
}

function PolicyToggleRow({ family, row, canEdit, pendingFamily, onToggle }: ToggleRowProps) {
  const mode: OperatorPolicyMode = row?.mode ?? 'auto'
  const isManual = mode === 'manual'
  const isPending = pendingFamily === family
  const disabled = !canEdit || !row || isPending

  function handleClick() {
    if (!row || !canEdit) return
    onToggle(family, row, isManual ? 'auto' : 'manual')
  }

  return (
    <div
      data-testid={`auto-policy-row-${family}`}
      className="flex items-center justify-between border-t border-zinc-800/50 px-6 py-2.5 text-sm"
    >
      <div className="flex items-center gap-3">
        <span className="font-mono text-zinc-300">{family}</span>
        {row === undefined && <span className="text-xs text-zinc-600">no policy contract</span>}
      </div>
      <button
        type="button"
        data-testid={`auto-policy-toggle-${family}`}
        data-mode={mode}
        onClick={handleClick}
        disabled={disabled}
        className={`rounded border px-3 py-1 font-mono text-xs uppercase tracking-wide transition-colors ${
          isManual
            ? 'border-amber-700 bg-amber-950/40 text-amber-200 hover:border-amber-500'
            : 'border-emerald-700 bg-emerald-950/40 text-emerald-200 hover:border-emerald-500'
        } disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-current`}
        title={
          canEdit
            ? `Click to flip to ${isManual ? 'auto' : 'manual'}`
            : 'Only the operator can change policy'
        }
      >
        {isPending ? '…' : mode}
      </button>
    </div>
  )
}

function SkeletonRow({ family }: { family: SwapFamily }) {
  return (
    <div className="flex items-center justify-between border-t border-zinc-800/50 px-6 py-2.5">
      <span className="font-mono text-zinc-300">{family}</span>
      <Skeleton className="h-7 w-16" />
    </div>
  )
}

export function AutoPolicyCard() {
  const role = useActiveOrgRole()
  const canEdit = role === 'operator'
  const { client } = useLedgerClient()
  const { rows, isLoading, error, refetch } = useOperatorPolicies()
  const queryClient = useQueryClient()
  const [pendingFamily, setPendingFamily] = useState<SwapFamily | null>(null)
  const [actionError, setActionError] = useState<Error | null>(null)
  const rowByFamily = new Map(rows.map((r) => [r.family, r] as const))

  async function handleToggle(
    family: SwapFamily,
    row: OperatorPolicyRow,
    next: OperatorPolicyMode,
  ) {
    if (!client) return
    setPendingFamily(family)
    setActionError(null)
    try {
      await setOperatorPolicyMode(client, { contractId: row.contractId, newMode: next })
      // SetMode rotates the cid; force a refetch instead of an optimistic update
      // (memory: reference_daml_cid_rotation).
      await queryClient.invalidateQueries({ queryKey: [OPERATOR_POLICIES_QUERY_KEY] })
    } catch (err) {
      setActionError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      setPendingFamily(null)
    }
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900">
      <div className="border-b border-zinc-800 px-6 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          {CARD_TITLE}
        </h2>
        <p className="mt-1 text-xs text-zinc-500">{CARD_HINT}</p>
      </div>

      {error ? (
        <div className="px-6 py-4">
          <ErrorState error={error} onRetry={refetch} retryLabel="Retry policy" />
        </div>
      ) : (
        <div data-testid="auto-policy-rows">
          {ALL_FAMILIES.map((family) =>
            isLoading ? (
              <SkeletonRow key={family} family={family} />
            ) : (
              <PolicyToggleRow
                key={family}
                family={family}
                row={rowByFamily.get(family)}
                canEdit={canEdit}
                pendingFamily={pendingFamily}
                onToggle={handleToggle}
              />
            ),
          )}
        </div>
      )}

      {actionError && (
        <div
          data-testid="auto-policy-action-error"
          className="border-t border-red-900 bg-red-950/40 px-6 py-2 text-xs text-red-200"
        >
          {actionError.message}
        </div>
      )}
    </div>
  )
}
