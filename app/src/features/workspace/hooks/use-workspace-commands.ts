'use client'

import type { Dispatch } from 'react'
import { useCallback } from 'react'
import { useConfig } from '@/shared/contexts/config-context'
import type { LedgerClient } from '@/shared/ledger/client'
import { partyMatchesHint } from '@/shared/ledger/party-match'
import {
  resolveMatureInputs,
  resolveSettlementInputs,
  resolveTerminateInputs,
} from '../ledger/settlement-inputs'
import {
  createTerminateProposal,
  exerciseProposalChoice,
  exerciseTerminateProposalChoice,
  exerciseWorkflowChoice,
  proposeSwap,
} from '../ledger/swap-actions'
import { resolveTriggerLifecycleInputs } from '../ledger/trigger-lifecycle-inputs'
import type { ObservablesConfig, StatusAction } from '../types'
import type { Action, WorkspaceReducerState } from './use-workspace-reducer'

// Demo fallback used when /api/config hasn't populated observables yet (pre-
// task 26 deployments, or in isolated tests). Matches the shape emitted by
// the config route so production callers get the real values from context.
const DEFAULT_OBSERVABLES: ObservablesConfig = {
  IRS: { rateIds: ['USD-SOFR'], kind: 'periodic-fixing', enabled: true },
  OIS: { rateIds: ['USD-SOFR'], kind: 'periodic-fixing', enabled: true },
  BASIS: { rateIds: ['USD-SOFR'], kind: 'periodic-fixing', enabled: false },
  XCCY: { rateIds: ['USD-SOFR'], kind: 'periodic-fixing', enabled: false },
  CDS: {
    rateIdPattern: 'CDS/{refName}/{DefaultProb|Recovery}',
    kind: 'credit-event',
    enabled: true,
  },
  CCY: { rateIds: [], kind: 'none', enabled: true },
  FX: { rateIds: [], kind: 'none', enabled: true },
  ASSET: { rateIdPattern: 'ASSET/{assetId}', kind: 'price', enabled: false },
  FpML: { rateIds: [], kind: 'embedded', enabled: true },
}

/**
 * Ledger-side commands: `propose` creates a *Proposal contract; `exerciseAction`
 * routes by `action.target` to the proposal / workflow / margin dispatcher.
 *
 * Keeping commands in their own hook means the state reducer stays pure React
 * and the composer can compose without knowing Daml template names.
 */
export function useWorkspaceCommands(args: {
  client: LedgerClient | null
  activeParty: string | null
  state: WorkspaceReducerState
  dispatch: Dispatch<Action>
}): {
  propose: () => Promise<void>
  proposeTerminate: (args: { pvAmount: number; reason: string }) => Promise<void>
  exerciseAction: (action: StatusAction, extraArgs?: Record<string, unknown>) => Promise<void>
} {
  const { client, activeParty, state, dispatch } = args
  const { config } = useConfig()
  const observables: ObservablesConfig =
    (config?.observables as ObservablesConfig | undefined) ?? DEFAULT_OBSERVABLES
  // Allowed currency codes — passed to proposeSwap so CCY/FX proposals
  // can reject any currency the operator hasn't seeded a factory for.
  const allowedCurrencies: string[] | undefined = config?.currencies?.map((c) => c.code)

  const propose = useCallback(async () => {
    if (!client || !activeParty) {
      alert('Please select a party from the header before proposing.')
      return
    }
    try {
      const { contractId } = await proposeSwap(client, {
        swapType: state.swapType,
        legs: state.legs,
        dates: state.dates,
        proposerHint: activeParty,
        counterpartyHint: state.counterparty,
        allowedCurrencies,
      })
      dispatch({ type: 'PROPOSE_SUCCESS', contractId })
      localStorage.removeItem(`irsforge:draft:${state.draftId}`)
    } catch (err) {
      console.error('Propose failed:', err)
      alert(err instanceof Error ? err.message : 'Failed to submit proposal')
    }
  }, [
    client,
    activeParty,
    state.swapType,
    state.legs,
    state.dates,
    state.counterparty,
    state.draftId,
    allowedCurrencies,
    dispatch,
  ])

  const proposeTerminate = useCallback(
    async (terminateArgs: { pvAmount: number; reason: string }) => {
      if (!client || !activeParty) throw new Error('No ledger client or active party')
      if (!state.workflowContractId || !state.workflowPartyA || !state.workflowPartyB) {
        throw new Error('Workflow not yet resolved')
      }
      const proposer = partyMatchesHint(state.workflowPartyA, activeParty)
        ? state.workflowPartyA
        : state.workflowPartyB
      const counterparty =
        proposer === state.workflowPartyA ? state.workflowPartyB : state.workflowPartyA
      const operator = await client.resolvePartyId('Operator')
      // Resolve every configured regulator party. Demo profile has one;
      // multi-jurisdiction production deployments may have several.
      const regulatorOrgs = (config?.orgs ?? []).filter((o) => o.role === 'regulator')
      const regulators = await Promise.all(regulatorOrgs.map((o) => client.resolvePartyId(o.hint)))
      await createTerminateProposal(client, {
        operator,
        regulators,
        proposer,
        counterparty,
        workflowContractId: state.workflowContractId,
        proposedPvAmount: terminateArgs.pvAmount,
        reason: terminateArgs.reason,
      })
      // A TerminateProposal was just created; refetch so `pendingUnwind` picks
      // it up and the right-panel flips into the Pending Unwind view.
      dispatch({ type: 'REFETCH_ACTIVE_CONTRACTS' })
    },
    [
      client,
      activeParty,
      config,
      state.workflowContractId,
      state.workflowPartyA,
      state.workflowPartyB,
      dispatch,
    ],
  )

  const exerciseAction = useCallback(
    async (action: StatusAction, extraArgs: Record<string, unknown> = {}) => {
      if (!client) throw new Error('No ledger client')

      if (action.target === 'proposal') {
        if (!state.contractId) throw new Error('No proposal contract id')
        const { workflowContractId } = await exerciseProposalChoice(client, {
          swapType: state.swapType,
          proposalContractId: state.contractId,
          choiceKey: action.choice,
          extra: extraArgs,
        })
        dispatch({ type: 'EXERCISE_SUCCESS', choiceKey: action.choice, workflowContractId })
        return
      }

      if (action.target === 'workflow') {
        let resolvedArgs = extraArgs
        if (action.choice === 'Settle') {
          if (!state.workflowPartyA || !state.workflowPartyB) {
            throw new Error('Workflow parties not yet resolved')
          }
          const inputs = await resolveSettlementInputs(client, {
            workflowContractId: state.workflowContractId!,
            partyA: state.workflowPartyA,
            partyB: state.workflowPartyB,
          })
          resolvedArgs = { ...inputs, ...extraArgs }
        }
        if (action.choice === 'Mature') {
          if (!state.workflowPartyA || !state.workflowPartyB) {
            throw new Error('Workflow parties not yet resolved')
          }
          const inputs = await resolveMatureInputs(client, {
            workflowContractId: state.workflowContractId!,
            partyA: state.workflowPartyA,
            partyB: state.workflowPartyB,
          })
          resolvedArgs = { ...inputs, ...extraArgs }
        }
        if (action.choice === 'TriggerLifecycle') {
          // Per-family dispatch: IRS needs SOFR observations, CDS needs
          // instrument-carried rate ids, CCY/FX/FpML/ASSET-disabled take
          // an empty observableCids. The event date is today — the
          // lifecycle rule picks up any unfixed coupons ≤ today.
          const eventDate = new Date().toISOString().split('T')[0]
          const inputs = await resolveTriggerLifecycleInputs(client, {
            swapType: state.swapType,
            instrument: state.workflowInstrument,
            observablesConfig: observables,
            eventDate,
          })
          resolvedArgs = { ...inputs, ...extraArgs }
        }
        await exerciseWorkflowChoice(client, {
          workflowContractId: state.workflowContractId,
          choice: action.choice,
          args: resolvedArgs,
        })
        // Workflow choices (TriggerLifecycle, Settle, Mature) change the set
        // of Effect / SwapWorkflow contracts. Bump the refetch nonce so the
        // right-panel's Outstanding count, Settle button, and maturity flag
        // reflect the post-choice state without waiting for a page reload.
        dispatch({ type: 'REFETCH_ACTIVE_CONTRACTS' })
        return
      }

      if (action.target === 'terminateProposal') {
        if (action.choice === 'propose') return
        if (!state.pendingUnwind) throw new Error('No pending unwind proposal')
        const { proposalCid, proposer, counterparty } = state.pendingUnwind
        let choiceArgs: Record<string, unknown> = {}
        if (action.choice === 'TpAccept') {
          choiceArgs = (await resolveTerminateInputs(client, {
            proposer,
            counterparty,
          })) as unknown as Record<string, unknown>
        }
        await exerciseTerminateProposalChoice(client, {
          proposalCid,
          choice: action.choice,
          args: choiceArgs,
        })
        // Accept/Reject archives the TerminateProposal and (on accept) the
        // SwapWorkflow. Refetch so pendingUnwind clears and swapStatus
        // reflects the terminated workflow.
        dispatch({ type: 'REFETCH_ACTIVE_CONTRACTS' })
        return
      }
    },
    [
      client,
      state.contractId,
      state.swapType,
      state.workflowContractId,
      state.workflowPartyA,
      state.workflowPartyB,
      state.workflowInstrument,
      state.pendingUnwind,
      observables,
      dispatch,
    ],
  )

  return { propose, proposeTerminate, exerciseAction }
}
