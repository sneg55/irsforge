'use client'

import type { Dispatch } from 'react'
import { useEffect } from 'react'
import type { LedgerClient } from '@/shared/ledger/client'
import { partyMatchesHint } from '@/shared/ledger/party-match'
import type { SwapStatus, SwapType } from '../types'
import { PROPOSAL_TEMPLATES } from './build-proposal-payload'
import { hydrateProposalPayload } from './hydrate-proposal-legs'
import type { Action } from './use-workspace-reducer'

export function useProposalRole(
  args: {
    contractId: string | null
    client: LedgerClient | null
    activeParty: string | null
    swapStatus: SwapStatus | null
    alreadyResolved: boolean
  },
  dispatch: Dispatch<Action>,
): void {
  const { contractId, client, activeParty, swapStatus, alreadyResolved } = args

  useEffect(() => {
    if (!contractId || !client || !activeParty) return
    if (swapStatus !== 'Proposed') return
    if (alreadyResolved) return

    const allTypes = Object.entries(PROPOSAL_TEMPLATES)
    void Promise.all(
      allTypes.map(([type, templateId]) =>
        client
          .query<{ contractId: string; payload: Record<string, unknown> }>(templateId)
          .then((contracts) => {
            const match = contracts.find((c) => c.contractId === contractId)
            return match ? { type, match } : null
          })
          .catch(() => null),
      ),
    ).then((results) => {
      const found = results.find((r) => r !== null)
      if (!found) return
      const { type, match } = found
      const p = match.payload
      const proposerStr = String(p.proposer ?? '')
      const counterpartyStr = String(p.counterparty ?? '')
      const partyHint = activeParty ?? ''
      const isProposer = !!partyHint && partyMatchesHint(proposerStr, partyHint)
      const isCounterparty = !!partyHint && partyMatchesHint(counterpartyStr, partyHint)
      // Operator (or any third party) viewing the proposal matches neither —
      // skip role dispatch so OnChainPanel renders no Accept/Reject/Withdraw.
      // Without this guard the false-counterparty fallthrough showed
      // structurally invalid Accept buttons to operators (8b8b5c7-style trap).
      if (!isProposer && !isCounterparty) return
      const otherParty = isProposer ? counterpartyStr : proposerStr
      const swapType = type as SwapType
      dispatch({
        type: 'RESOLVE_PROPOSAL',
        swapType,
        role: isProposer ? 'proposer' : 'counterparty',
        counterparty: otherParty.split('::')[0] ?? '',
      })
      // Also replace the default legs/dates with the proposal's real terms.
      // Without this the workspace always renders 50M/4.25%/5Y for every
      // proposal regardless of what the blotter row showed.
      try {
        const hydrated = hydrateProposalPayload(swapType, p, partyHint)
        dispatch({
          type: 'HYDRATE_PROPOSAL_PAYLOAD',
          swapType: hydrated.swapType,
          legs: hydrated.legs,
          dates: hydrated.dates,
        })
      } catch (err) {
        // Payload shape mismatch (e.g. a schema field was renamed) should
        // degrade to "defaults shown" rather than blank the workspace.
        if (typeof console !== 'undefined') {
          console.warn('[use-proposal-role] payload hydrate failed', err)
        }
      }
    })
  }, [contractId, client, activeParty, swapStatus, alreadyResolved, dispatch])
}
