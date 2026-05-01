'use client'

import { useQuery } from '@tanstack/react-query'
import { PartyName } from 'canton-party-directory/ui'
import Link from 'next/link'
import { useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { ROUTES } from '@/shared/constants/routes'
import { useLedger } from '@/shared/contexts/ledger-context'
import type { SwapFamily } from '@/shared/hooks/use-swap-instruments'
import { SWAP_WORKFLOW_TEMPLATE_ID } from '@/shared/ledger/template-ids'
import type { ContractResult, SwapWorkflow } from '@/shared/ledger/types'
import { ManualTriggerDialog } from './manual-trigger-dialog'

// Families the operator override (manualTriggerLifecycle) can drive directly.
// IRS/CDS need rate observations resolved by the workspace's full trigger flow.
const ZERO_OBSERVABLE_FAMILIES: ReadonlySet<SwapFamily> = new Set(['CCY', 'FX', 'FpML'])

interface Props {
  stalled: boolean
}

interface CandidateRow {
  contractId: string
  swapType: SwapFamily
  partyA: string
  partyB: string
  notional: string
  manualEligible: boolean
}

function formatNotional(raw: string): string {
  const n = Number(raw)
  if (!Number.isFinite(n)) return raw
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`
  return n.toFixed(0)
}

export function ManualFixingsPicker({ stalled }: Props) {
  const { client, activeOrg } = useLedger()
  const orgId = activeOrg?.id ?? ''
  const [prefilledCid, setPrefilledCid] = useState<string | null>(null)

  const { data: workflows = [], isLoading } = useQuery<ContractResult<SwapWorkflow>[]>({
    queryKey: ['operator-manual-trigger-candidates'],
    queryFn: () => client!.query<ContractResult<SwapWorkflow>>(SWAP_WORKFLOW_TEMPLATE_ID),
    enabled: !!client && stalled,
    refetchInterval: 30_000,
    staleTime: 25_000,
  })

  // Healthy path: single disabled button with the original copy. Keeps the
  // surface unobtrusive when the scheduler is doing its job.
  if (!stalled) {
    return (
      <div data-testid="manual-fixings-healthy">
        <button
          type="button"
          data-testid="publish-fixing-btn"
          disabled
          className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Publish fixing manually
        </button>
        <p className="mt-1 text-xs text-zinc-600">Available only when scheduler is stalled.</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
    )
  }

  const rows: CandidateRow[] = workflows.map((w) => ({
    contractId: w.contractId,
    swapType: w.payload.swapType as SwapFamily,
    partyA: w.payload.partyA,
    partyB: w.payload.partyB,
    notional: w.payload.notional,
    manualEligible: ZERO_OBSERVABLE_FAMILIES.has(w.payload.swapType as SwapFamily),
  }))

  if (rows.length === 0) {
    return (
      <p className="text-xs text-zinc-600" data-testid="manual-fixings-empty">
        No live swaps to trigger.
      </p>
    )
  }

  return (
    <>
      <p className="mb-2 text-xs text-zinc-500">
        Scheduler is stalled. Pick a swap to publish a fixing manually for today.
      </p>
      <table className="w-full text-xs" data-testid="manual-fixings-table">
        <thead>
          <tr className="text-left text-zinc-500">
            <th className="pb-1 pr-3 font-normal">Type</th>
            <th className="pb-1 pr-4 font-normal">Pair</th>
            <th className="pb-1 pr-4 font-normal">Notional</th>
            <th className="pb-1 font-normal" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const workspaceHref = orgId ? ROUTES.ORG_WORKSPACE_SWAP(orgId, r.contractId) : '#'
            return (
              <tr
                key={r.contractId}
                data-testid={`manual-fixings-row-${r.contractId.slice(0, 12)}`}
                className="text-zinc-300"
              >
                <td className="py-0.5 pr-3 font-mono">{r.swapType}</td>
                <td className="py-0.5 pr-4">
                  <span className="flex items-center gap-1 text-zinc-300">
                    <PartyName identifier={r.partyA} />
                    <span className="text-zinc-500">–</span>
                    <PartyName identifier={r.partyB} />
                  </span>
                </td>
                <td className="py-0.5 pr-4 font-mono">{formatNotional(r.notional)}</td>
                <td className="py-0.5 text-right">
                  {r.manualEligible ? (
                    <button
                      type="button"
                      data-testid={`manual-fixings-trigger-${r.contractId.slice(0, 12)}`}
                      onClick={() => setPrefilledCid(r.contractId)}
                      className="rounded border border-orange-700/60 px-2 py-0.5 text-xs text-orange-300 hover:border-orange-500 hover:text-orange-200"
                    >
                      Trigger
                    </button>
                  ) : (
                    <Link
                      href={workspaceHref}
                      className="text-xs text-zinc-500 underline decoration-dotted hover:text-zinc-300"
                      title={`${r.swapType} needs rate observations — use Workspace trigger`}
                    >
                      Workspace →
                    </Link>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <ManualTriggerDialog
        open={prefilledCid !== null}
        onClose={() => setPrefilledCid(null)}
        defaultSwapCid={prefilledCid ?? ''}
      />
    </>
  )
}
