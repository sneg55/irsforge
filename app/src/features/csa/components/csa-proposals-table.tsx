'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { PartyName } from 'canton-party-directory/ui'
import { exerciseCsaProposalChoice } from '@/features/operator/ledger/csa-proposal-actions'
import { useLedgerClient } from '@/shared/hooks/use-ledger-client'
import { CSA_PROPOSALS_QUERY_KEY, type CsaProposalRow } from '../hooks/use-csa-proposals'

function ProposalActions({ row }: { row: CsaProposalRow }) {
  const { client } = useLedgerClient()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (choice: 'accept' | 'reject' | 'withdraw') =>
      exerciseCsaProposalChoice(client!, row.contractId, choice),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [CSA_PROPOSALS_QUERY_KEY] })
    },
  })

  if (row.directionForMe === 'in') {
    return (
      <div className="flex gap-2">
        <button
          type="button"
          className="rounded bg-green-700 px-2 py-0.5 text-xs font-medium text-white hover:bg-green-600 disabled:opacity-40"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate('accept')}
        >
          Accept
        </button>
        <button
          type="button"
          className="rounded bg-red-800 px-2 py-0.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-40"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate('reject')}
        >
          Reject
        </button>
      </div>
    )
  }

  if (row.directionForMe === 'out') {
    return (
      <button
        type="button"
        className="rounded bg-zinc-700 px-2 py-0.5 text-xs font-medium text-zinc-200 hover:bg-zinc-600 disabled:opacity-40"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate('withdraw')}
      >
        Withdraw
      </button>
    )
  }

  return null
}

function directionLabel(dir: CsaProposalRow['directionForMe']): string {
  if (dir === 'in') return 'In'
  if (dir === 'out') return 'Out'
  return 'Observer'
}

function ProposalRow({ row }: { row: CsaProposalRow }) {
  // CsaProposal accept-side mapping: `partyA = proposer, partyB = counterparty`,
  // so thresholdDirA tracks the proposer's threshold and thresholdDirB the
  // counterparty's. Render both with PartyName instead of leaking the A/B
  // ledger labels into the UI.
  const otherParty = row.directionForMe === 'out' ? row.counterpartyHint : row.proposerHint
  return (
    <tr data-testid={`proposal-row-${row.contractId}`} className="border-b border-zinc-800/50">
      <td className="px-4 py-2 text-xs text-zinc-400">{directionLabel(row.directionForMe)}</td>
      <td className="px-4 py-2 text-xs text-zinc-200">
        <PartyName identifier={otherParty} />
      </td>
      <td className="px-4 py-2 font-mono text-xs text-zinc-300">{row.mta.toLocaleString()}</td>
      <td className="px-4 py-2 text-xs text-zinc-300">
        <PartyName identifier={row.proposerHint} />{' '}
        <span className="font-mono">{row.thresholdDirA.toLocaleString()}</span>{' '}
        <span className="text-zinc-600">·</span> <PartyName identifier={row.counterpartyHint} />{' '}
        <span className="font-mono">{row.thresholdDirB.toLocaleString()}</span>
      </td>
      <td className="px-4 py-2 font-mono text-xs text-zinc-300">{row.rounding.toLocaleString()}</td>
      <td className="px-4 py-2">
        <ProposalActions row={row} />
      </td>
    </tr>
  )
}

export interface CsaProposalsTableProps {
  rows: CsaProposalRow[]
}

/**
 * Renders a table of CsaProposal rows with direction-appropriate action
 * buttons (Accept/Reject for 'in', Withdraw for 'out', none for 'observer').
 * Returns null when rows is empty.
 */
export function CsaProposalsTable({ rows }: CsaProposalsTableProps) {
  if (rows.length === 0) return null

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-zinc-800">
            <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
              Direction
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
              Counterparty
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
              MTA
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
              Threshold
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
              Rounding
            </th>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <ProposalRow key={row.contractId} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
