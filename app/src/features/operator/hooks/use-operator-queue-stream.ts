'use client'

import { useMemo, useState } from 'react'
import { useLedger } from '@/shared/contexts/ledger-context'
import { useStreamedEvents } from '@/shared/hooks/use-streamed-events'
import {
  OPERATOR_ACCEPT_ACK,
  OPERATOR_ACCEPT_ACK_ENTRIES,
  type SwapFamily,
} from '@/shared/ledger/operator-registry'
import { CSA_TEMPLATE_ID } from '@/shared/ledger/template-ids'
import type { CsaPayload, CsaState } from '@/shared/ledger/types'
import type { OperatorQueueItem, UseOperatorQueueResult } from './use-operator-queue'
import { useOperatorQueue } from './use-operator-queue'

// Single WebSocket subscription driving the operator queue off Canton's
// /v1/stream/query. Replaces the 9-parallel polling queries in
// useOperatorQueue for the steady-state path. Falls back to the polling
// hook when the stream fails to connect (e.g. JWT refresh, participant
// reboot, or running against a JSON API that rejects the multi-template
// filter) so the operator page never goes blank on transport issues.

interface AcceptAckPayload {
  operator: string
  proposer: string
  counterparty: string
  proposalCid: string
}

interface QueueRecord {
  kind: 'accept-ack' | 'dispute'
  family?: SwapFamily
  acceptAck?: AcceptAckPayload
  csa?: CsaPayload
}

function hintFromParty(fullParty: string): string {
  return fullParty.split('::')[0] ?? fullParty
}

function familyForTemplateId(templateId: string): SwapFamily | null {
  for (const e of OPERATOR_ACCEPT_ACK_ENTRIES) {
    if (e.templateId === templateId) return e.family
  }
  return null
}

function csaStateFrom(payload: CsaPayload): CsaState {
  return payload.state
}

function buildItems(records: Map<string, QueueRecord>, orgId: string): OperatorQueueItem[] {
  const out: OperatorQueueItem[] = []
  for (const [cid, rec] of records) {
    if (rec.kind === 'accept-ack' && rec.family && rec.acceptAck) {
      const proposerHint = hintFromParty(rec.acceptAck.proposer)
      const counterpartyHint = hintFromParty(rec.acceptAck.counterparty)
      out.push({
        type: 'accept-ack',
        id: `accept-ack-${cid}`,
        title: `${rec.family} proposal — ${proposerHint} → ${counterpartyHint}: awaiting co-sign`,
        subtitle: `${rec.family} proposal — awaiting co-sign`,
        deepLinkHref: `/org/${orgId}/workspace?proposal=${encodeURIComponent(rec.acceptAck.proposalCid)}`,
        sortKey: 50,
        contractId: cid,
        family: rec.family,
        proposer: rec.acceptAck.proposer,
        counterparty: rec.acceptAck.counterparty,
        proposalCid: rec.acceptAck.proposalCid,
      })
    } else if (
      rec.kind === 'dispute' &&
      rec.csa &&
      (csaStateFrom(rec.csa) === 'MarkDisputed' || csaStateFrom(rec.csa) === 'Escalated')
    ) {
      const hintA = hintFromParty(rec.csa.partyA)
      const hintB = hintFromParty(rec.csa.partyB)
      const pair = `${rec.csa.partyA}|${rec.csa.partyB}`
      const escalated = csaStateFrom(rec.csa) === 'Escalated'
      out.push({
        type: 'dispute',
        id: `dispute-${cid}`,
        title: `CSA ${hintA}–${hintB}: ${escalated ? 'escalated dispute' : 'dispute'}`,
        subtitle: escalated
          ? 'Escalated — operator adjudication required'
          : 'Mark disputed — operator adjudication required',
        deepLinkHref: `/org/${orgId}/csa?pair=${encodeURIComponent(pair)}`,
        sortKey: 100,
        csaContractId: cid,
        csaPartyA: rec.csa.partyA,
        csaPartyB: rec.csa.partyB,
        csaCcy: rec.csa.valuationCcy,
      })
    }
  }
  return out.sort((a, b) => b.sortKey - a.sortKey)
}

const ACCEPT_ACK_TEMPLATE_IDS = OPERATOR_ACCEPT_ACK_ENTRIES.map((e) => e.templateId)
const ALL_TEMPLATE_IDS = [...ACCEPT_ACK_TEMPLATE_IDS, CSA_TEMPLATE_ID] as const

export function useOperatorQueueStream(): UseOperatorQueueResult {
  const { activeOrg } = useLedger()
  const orgId = activeOrg?.id ?? 'demo'
  const [records, setRecords] = useState<Map<string, QueueRecord>>(new Map())
  const [streamError, setStreamError] = useState<Error | null>(null)

  const { status, lastError } = useStreamedEvents({
    templateIds: [...ALL_TEMPLATE_IDS],
    enabled: true,
    onCreated: (payload, contractId, templateId) => {
      const family = familyForTemplateId(templateId)
      setRecords((prev) => {
        const next = new Map(prev)
        if (templateId === CSA_TEMPLATE_ID) {
          next.set(contractId, { kind: 'dispute', csa: payload as CsaPayload })
        } else if (family) {
          next.set(contractId, {
            kind: 'accept-ack',
            family,
            acceptAck: payload as AcceptAckPayload,
          })
        }
        return next
      })
    },
    onArchived: (contractId) => {
      setRecords((prev) => {
        if (!prev.has(contractId)) return prev
        const next = new Map(prev)
        next.delete(contractId)
        return next
      })
    },
    onError: (err) => setStreamError(err),
  })

  const streamItems = useMemo(() => buildItems(records, orgId), [records, orgId])
  const streamHealthy = status === 'open' || status === 'closed'

  // When the stream has fallen back (WebSocket failed past retry budget),
  // delegate to the polling hook so the page still works. This mirrors the
  // useStreamedContracts convention used by useCurveStream. Poll queries
  // are gated behind `enabled` so they don't fire concurrently with a
  // healthy stream — only activate on fallback.
  const useFallback = status === 'fallback'
  const polling = useOperatorQueue({ enabled: useFallback })

  if (useFallback) return polling

  return {
    items: streamItems,
    isLoading: !streamHealthy && records.size === 0,
    isError: streamError !== null,
    error: streamError ?? lastError,
    refetch: () => {
      // Stream is push-based; "refetch" is a no-op. Callers relying on
      // refetch to recover from transient errors should trigger a page
      // reload via ErrorState.
      setStreamError(null)
    },
  }
}
