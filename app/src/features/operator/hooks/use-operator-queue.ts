'use client'

import { useQueries } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useCsas } from '@/features/csa/hooks/use-csas'
import { useLedger } from '@/shared/contexts/ledger-context'
import { OPERATOR_ACCEPT_ACK_ENTRIES, type SwapFamily } from '@/shared/ledger/operator-registry'

export type OperatorQueueItemType = 'dispute' | 'accept-ack' | 'lifecycle'
export type { SwapFamily } from '@/shared/ledger/operator-registry'

export interface OperatorQueueItem {
  type: OperatorQueueItemType
  id: string
  title: string
  subtitle: string
  deepLinkHref: string
  sortKey: number
  /** Present only on accept-ack items — the AcceptAck contract id for co-sign */
  contractId?: string
  /** Present only on accept-ack items — swap family for ConfirmAccept dispatch */
  family?: SwapFamily
  /** Present only on accept-ack items — proposer / counterparty / proposalCid for preview */
  proposer?: string
  counterparty?: string
  proposalCid?: string
  /** Present only on dispute items — the CSA contract id for inline resolution */
  csaContractId?: string
  csaPartyA?: string
  csaPartyB?: string
  csaCcy?: string
}

interface AcceptAckPayload {
  operator: string
  proposer: string
  counterparty: string
  proposalCid: string
}

interface AcceptAckContractResult {
  contractId: string
  payload: AcceptAckPayload
}

export interface UseOperatorQueueResult {
  items: OperatorQueueItem[]
  isLoading: boolean
  isError: boolean
  error: Error | null
  refetch: () => void
}

function hintFromParty(fullParty: string): string {
  return fullParty.split('::')[0] ?? fullParty
}

export function useOperatorQueue(opts?: { enabled?: boolean }): UseOperatorQueueResult {
  const enabled = opts?.enabled ?? true
  const { client, activeOrg } = useLedger()
  const orgId = activeOrg?.id ?? 'demo'

  const csasResult = useCsas()

  // One query per AcceptAck family driven off the shared registry. The
  // loop keeps hook order stable across renders because
  // OPERATOR_ACCEPT_ACK_ENTRIES is a module-level frozen array.
  const ackQueries = useQueries({
    queries: OPERATOR_ACCEPT_ACK_ENTRIES.map((entry) => ({
      queryKey: ['accept-ack', entry.family, orgId] as const,
      queryFn: () => client!.query<AcceptAckContractResult>(entry.templateId),
      enabled: enabled && !!client,
    })),
  })

  const anyAckLoading = ackQueries.some((q) => q.isLoading)
  const isLoading = csasResult.isLoading || anyAckLoading
  const ackError = ackQueries.find((q) => q.error)?.error as Error | undefined
  const error = csasResult.error ?? ackError ?? null
  const isError = error !== null

  const items = useMemo(() => {
    const disputeItems: OperatorQueueItem[] = csasResult.data
      .filter((csa) => csa.state === 'MarkDisputed' || csa.state === 'Escalated')
      .map((csa) => {
        const hintA = hintFromParty(csa.partyA)
        const hintB = hintFromParty(csa.partyB)
        const pair = `${csa.partyA}|${csa.partyB}`
        const escalated = csa.state === 'Escalated'
        return {
          type: 'dispute' as const,
          id: `dispute-${csa.contractId}`,
          title: `CSA ${hintA}–${hintB}: ${escalated ? 'escalated dispute' : 'dispute'}`,
          subtitle: escalated
            ? 'Escalated — operator adjudication required'
            : 'Mark disputed — operator adjudication required',
          deepLinkHref: `/org/${orgId}/csa?pair=${encodeURIComponent(pair)}`,
          sortKey: 100,
          csaContractId: csa.contractId,
          csaPartyA: csa.partyA,
          csaPartyB: csa.partyB,
          csaCcy: csa.valuationCcy,
        }
      })

    const ackItems: OperatorQueueItem[] = ackQueries.flatMap((query, i) => {
      const entry = OPERATOR_ACCEPT_ACK_ENTRIES[i]
      const contracts = query.data ?? []
      return contracts.map((c) => {
        const proposerHint = hintFromParty(c.payload.proposer)
        const counterpartyHint = hintFromParty(c.payload.counterparty)
        return {
          type: 'accept-ack' as const,
          id: `accept-ack-${c.contractId}`,
          title: `${entry.family} proposal — ${proposerHint} → ${counterpartyHint}: awaiting co-sign`,
          subtitle: `${entry.family} proposal — awaiting co-sign`,
          deepLinkHref: `/org/${orgId}/workspace?proposal=${encodeURIComponent(c.payload.proposalCid)}`,
          sortKey: 50,
          contractId: c.contractId,
          family: entry.family,
          proposer: c.payload.proposer,
          counterparty: c.payload.counterparty,
          proposalCid: c.payload.proposalCid,
        }
      })
    })

    return [...disputeItems, ...ackItems].sort((a, b) => b.sortKey - a.sortKey)
  }, [csasResult.data, ackQueries, orgId])

  const refetch = () => {
    void csasResult.refetch()
    for (const q of ackQueries) void q.refetch()
  }

  return { items, isLoading, isError, error, refetch }
}
