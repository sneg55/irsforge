'use client'

import type { Dispatch } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { isOperatorParty, isRegulatorParty } from '@/shared/hooks/use-is-operator'
import type { SwapFamily } from '@/shared/hooks/use-swap-instruments'
import { useSwapInstruments } from '@/shared/hooks/use-swap-instruments'
import type { LedgerClient } from '@/shared/ledger/client'
import { getInstrumentMaturity } from '@/shared/ledger/instrument-helpers'
import { partyMatchesHint } from '@/shared/ledger/party-match'
import { EFFECT_TEMPLATE_ID } from '@/shared/ledger/template-ids'
import type { SwapWorkflow } from '@/shared/ledger/types'
import type { SwapStatus } from '../types'
import { hydrateWorkflowPayload } from './hydrate-workflow-legs'
import type { Action } from './use-workspace-reducer'

type ContractResult<T> = { contractId: string; payload: T }

/**
 * Tracks the resolved workflow's instrumentKey so `useSwapInstruments` can
 * fetch the matching on-chain instrument asynchronously. Lifted out of the
 * useEffect so the query hook can be called unconditionally at the top level.
 */
interface ResolvedWorkflowRef {
  contractId: string
  swapType: SwapFamily
  instrumentKeyId: string
  payload: SwapWorkflow
}

/**
 * When the workspace enters the Active phase, resolve the workflow contract
 * and (best-effort) the active-party margin account. Dispatches SET_* actions
 * so subsequent choice exercises target the right contracts.
 *
 * Workflow match: prefers a SwapWorkflow whose partyA/partyB includes the
 * active party and whose notional matches the proposal notional (to
 * disambiguate multiple active swaps). Falls back to the single match if
 * only one workflow exists for this party.
 */
export function useActiveContracts(
  args: {
    client: LedgerClient | null
    activeParty: string | null
    swapStatus: SwapStatus | null
    proposalContractId: string | null
    notionalMatch: number | null
    /**
     * Monotonically-incrementing invalidation signal. Workspace commands bump
     * it after any ledger-mutating action so this hook's useEffect re-runs
     * and picks up new Effects / margin balances / terminate proposals —
     * otherwise the panel would stay stale until a status transition or
     * page reload.
     */
    refetchNonce?: number
  },
  dispatch: Dispatch<Action>,
): void {
  const {
    client,
    activeParty,
    swapStatus,
    notionalMatch,
    proposalContractId,
    refetchNonce = 0,
  } = args

  // Track the matched workflow's swap family + instrument key id so we can
  // call useSwapInstruments at the hook level (hooks must be unconditional).
  const [resolvedWorkflow, setResolvedWorkflow] = useState<ResolvedWorkflowRef | null>(null)
  // Stable identity of the workflow we've already pushed legs/dates for.
  // Cannot key on the SwapWorkflow contract id: Daml `create this with
  // <update>` rotates the cid on every choice, so a refetchNonce bump after
  // a lifecycle action (Settle / PostMargin / Mature / TriggerLifecycle)
  // would see a "new" cid for the same logical swap, re-dispatch
  // HYDRATE_PROPOSAL_PAYLOAD, and clobber post-hydrate user edits to
  // legs/dates — exactly when a trader is most likely to have edited the
  // panel. The instrument key id + party pair survives cid rotation.
  const lastHydratedKeyRef = useRef<string | null>(null)

  const families = useMemo(
    () => (resolvedWorkflow ? [resolvedWorkflow.swapType] : []),
    [resolvedWorkflow],
  )
  const { byInstrumentId } = useSwapInstruments(client, families)

  // Dispatch the instrument into the reducer whenever the instrument map
  // resolves or the matched workflow changes.
  useEffect(() => {
    if (!resolvedWorkflow) {
      dispatch({ type: 'SET_WORKFLOW_INSTRUMENT', instrument: null })
      dispatch({ type: 'SET_IS_PAST_MATURITY', value: false })
      lastHydratedKeyRef.current = null
      return
    }
    const instr = byInstrumentId.get(resolvedWorkflow.instrumentKeyId) ?? null
    dispatch({ type: 'SET_WORKFLOW_INSTRUMENT', instrument: instr })

    // Past-maturity gate for the workspace right-panel's Mature button.
    // Read the maturity date off the on-chain instrument (same source of
    // truth the operator passes to Mature's choice args). FpML has no
    // single termination date in the slim payload — keep it false until
    // Phase 3 widens FpmlSwapStreamPayload.
    if (instr) {
      const maturity = getInstrumentMaturity(instr)
      if (maturity !== '—') {
        const today = new Date().toISOString().split('T')[0]
        dispatch({ type: 'SET_IS_PAST_MATURITY', value: today >= maturity })
      } else {
        dispatch({ type: 'SET_IS_PAST_MATURITY', value: false })
      }
    } else {
      dispatch({ type: 'SET_IS_PAST_MATURITY', value: false })
    }

    // Hydrate workspace legs/dates from the on-chain workflow + instrument
    // exactly once per logical workflow. Without this the workspace renders
    // the hardcoded IRS defaults (50M / 4.25% / 5Y) for every active swap
    // opened via URL. Mirrors the proposal-side fix in use-proposal-role.ts.
    const hydrateKey = `${resolvedWorkflow.instrumentKeyId}|${resolvedWorkflow.payload.partyA}|${resolvedWorkflow.payload.partyB}`
    if (instr && hydrateKey !== lastHydratedKeyRef.current) {
      try {
        const hydrated = hydrateWorkflowPayload(
          resolvedWorkflow.swapType,
          resolvedWorkflow.payload,
          instr,
        )
        dispatch({
          type: 'HYDRATE_PROPOSAL_PAYLOAD',
          swapType: hydrated.swapType,
          legs: hydrated.legs,
          dates: hydrated.dates,
        })
        lastHydratedKeyRef.current = hydrateKey
      } catch (err) {
        if (typeof console !== 'undefined') {
          console.warn('[use-active-contracts] workflow hydrate failed', err)
        }
      }
    }
  }, [resolvedWorkflow, byInstrumentId, dispatch])

  useEffect(() => {
    // Run whenever we have a contract ID to resolve, regardless of current
    // swapStatus. This lets URL-hydrated SwapWorkflow IDs transition the
    // state out of the initial 'Proposed' (set by HYDRATE_FROM_SWAP) when
    // a matching workflow is found — the reducer's SET_WORKFLOW_CONTRACT
    // flips swapStatus to 'Active'.
    if (!client || !activeParty || !proposalContractId) return

    const operatorAllVisible = isOperatorParty(activeParty) || isRegulatorParty(activeParty)

    client
      .query<ContractResult<SwapWorkflow>>('Swap.Workflow:SwapWorkflow')
      .then((contracts) => {
        const mine = contracts.filter(
          (c) =>
            operatorAllVisible ||
            partyMatchesHint(c.payload.partyA, activeParty) ||
            partyMatchesHint(c.payload.partyB, activeParty) ||
            c.payload.regulators.some((r) => partyMatchesHint(r, activeParty)),
        )
        // Match selection depends on the current phase:
        //   - 'Active' (post-accept transition): the URL's contractId is
        //     the archived proposal; use notional to find the just-born
        //     workflow, with sole-match as fallback.
        //   - 'Proposed' (URL hydrate): the URL may point directly at a
        //     workflow (Blotter Active-tab row click), so an exact-id
        //     match is the only safe signal. Notional/sole fallbacks
        //     would spuriously auto-transition proposal views to Active.
        const match =
          swapStatus === 'Active'
            ? (mine.find((c) => c.contractId === proposalContractId) ??
              (notionalMatch != null
                ? mine.find((c) => Math.abs(parseFloat(c.payload.notional) - notionalMatch) < 0.5)
                : undefined) ??
              (mine.length === 1 ? mine[0] : undefined))
            : mine.find((c) => c.contractId === proposalContractId)
        if (match) {
          dispatch({ type: 'SET_WORKFLOW_CONTRACT', contractId: match.contractId })
          dispatch({
            type: 'SET_WORKFLOW_PARTIES',
            partyA: match.payload.partyA,
            partyB: match.payload.partyB,
          })
          dispatch({
            type: 'SET_WORKFLOW_REGULATORS',
            regulators: match.payload.regulators,
          })
          // Derive the counterparty hint from the matched workflow so the
          // on-chain panel renders a real party name instead of "—" when a
          // swap is opened via URL (no preceding RESOLVE_PROPOSAL fires).
          const otherPartyFull = partyMatchesHint(match.payload.partyA, activeParty)
            ? match.payload.partyB
            : match.payload.partyA
          dispatch({ type: 'SET_COUNTERPARTY', party: otherPartyFull.split('::')[0] ?? '' })
          // Lift the matched workflow's family + instrument key so the
          // top-level useSwapInstruments call can fetch the instrument.
          // Re-use the existing object when the cid hasn't changed so the
          // downstream hydrate effect doesn't refire on every refetch and
          // clobber user edits to legs/dates.
          setResolvedWorkflow((prev) =>
            prev && prev.contractId === match.contractId
              ? prev
              : {
                  contractId: match.contractId,
                  swapType: match.payload.swapType as SwapFamily,
                  instrumentKeyId: match.payload.instrumentKey.id.unpack,
                  payload: match.payload,
                },
          )
        }
      })
      .catch(() => {
        /* workflow not yet created — ignore */
      })

    client
      .query<ContractResult<unknown>>(EFFECT_TEMPLATE_ID)
      .then((effects) => {
        dispatch({ type: 'SET_OUTSTANDING_EFFECTS', count: effects.length })
      })
      .catch(() => {
        /* no effects yet — ignore */
      })

    client
      .query<
        ContractResult<{
          proposer: string
          counterparty: string
          workflowCid: string
          proposedPvAmount: string
          reason: string
          proposedAt: string
        }>
      >('Swap.Terminate:TerminateProposal')
      .then((proposals) => {
        // Captured via closure after the SwapWorkflow query resolves — but since
        // queries run concurrently we use a local reference. The workflowCid match
        // is the primary disambiguation; party-hint is the fallback.
        const mine = proposals.find(
          (p) =>
            partyMatchesHint(p.payload.proposer, activeParty) ||
            partyMatchesHint(p.payload.counterparty, activeParty),
        )
        if (!mine) {
          dispatch({ type: 'SET_PENDING_UNWIND', value: null })
          return
        }
        const role: 'proposer' | 'counterparty' = partyMatchesHint(
          mine.payload.proposer,
          activeParty,
        )
          ? 'proposer'
          : 'counterparty'
        dispatch({
          type: 'SET_PENDING_UNWIND',
          value: {
            proposal: {
              proposalCid: mine.contractId,
              proposer: mine.payload.proposer,
              counterparty: mine.payload.counterparty,
              pvAmount: parseFloat(mine.payload.proposedPvAmount),
              reason: mine.payload.reason,
              proposedAt: mine.payload.proposedAt,
            },
            role,
          },
        })
      })
      .catch(() => {
        dispatch({ type: 'SET_PENDING_UNWIND', value: null })
      })
  }, [client, activeParty, swapStatus, notionalMatch, proposalContractId, refetchNonce, dispatch])
}
