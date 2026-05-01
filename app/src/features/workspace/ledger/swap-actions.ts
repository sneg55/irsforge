import { readOperatorPolicy } from '@/shared/config/read-operator-policy'
import type { LedgerClient } from '@/shared/ledger/client'
import { PROPOSAL_DELEGATION_TEMPLATE_ID } from '@/shared/ledger/template-ids'
import { PROPOSAL_CHOICES, SWAP_TYPE_CONFIGS } from '../constants'
import { buildProposalPayload, PROPOSAL_TEMPLATES } from '../hooks/build-proposal-payload'
import type { LegConfig, SwapType } from '../types'
import type { WorkspaceDates } from '../utils/date-recalc'
import {
  getLegIndexId,
  resolveFloatingRateIndexCid,
  resolveFloatingRateIndexCidByIndexId,
} from './floating-rate-index'
import {
  delegationDispatchFor,
  extractCreatedProposalCid,
  resolveProposalDelegationCid,
} from './proposal-delegation'

const WORKFLOW_TEMPLATE = 'Swap.Workflow:SwapWorkflow'

export async function proposeSwap(
  client: LedgerClient,
  args: {
    swapType: SwapType
    legs: LegConfig[]
    dates: WorkspaceDates
    proposerHint: string
    counterpartyHint: string
    /**
     * Allowed currency codes for CCY/FX validation. Optional; callers
     * without config plumbing can omit it to skip currency validation.
     */
    allowedCurrencies?: string[]
  },
): Promise<{ contractId: string }> {
  // All six proposal templates now require `operator` as a co-signatory
  // (task 7: operator authorizes the Factory.Create in Accept). Resolve
  // it alongside proposer/counterparty so the payload is complete and
  // the multi-party submit has the right actAs list.
  const [proposer, counterparty, operator] = await Promise.all([
    client.resolvePartyId(args.proposerHint),
    client.resolvePartyId(args.counterpartyHint),
    client.resolvePartyId('Operator'),
  ])
  const result = buildProposalPayload(
    args.swapType,
    args.legs,
    {
      proposer,
      counterparty,
      operator,
      startDate: args.dates.effectiveDate.toISOString().split('T')[0],
      maturityDate: args.dates.maturityDate.toISOString().split('T')[0],
      allowedCurrencies: args.allowedCurrencies,
    },
    args.dates,
  )
  if (!result.ok) {
    // Surface as a plain Error; the caller (propose hook) catches and
    // alerts so the form can show a human-readable message.
    throw new Error(result.message)
  }
  // Every family routes through the operator-signed ProposalDelegation
  // so the trader's JWT (which in production OIDC profile only carries
  // actAs for their own party) is sufficient. Each Create<Family>Proposal
  // choice body has authority {operator (delegation sig), proposer
  // (controller)} — exactly what each proposal template's signatory
  // list requires. Demo profile keeps working because the demo JWT
  // covers every party anyway.
  const delegationCid = await resolveProposalDelegationCid(client, operator)
  const dispatch = delegationDispatchFor(
    args.swapType,
    proposer,
    counterparty,
    result.payload as Record<string, unknown>,
  )
  const raw = await client.exercise(
    PROPOSAL_DELEGATION_TEMPLATE_ID,
    delegationCid,
    dispatch.choice,
    dispatch.args,
  )
  const cid = extractCreatedProposalCid(raw)
  if (!cid) {
    throw new Error(`${dispatch.choice} returned no proposal contract id`)
  }
  return { contractId: cid }
}

/**
 * Exercise a choice on a `*Proposal` template. For `accept`, injects
 * `operator` / `regulator` party args (required by the Daml Accept choice)
 * and returns the created workflow contract id from the exercise response.
 *
 * IRS + OIS + ASSET Accept require a single `floatingRateIndexCid`; BASIS
 * Accept requires two (`leg0FloatingRateIndexCid` + `leg1FloatingRateIndexCid`)
 * because its two float legs can carry different indices. Every CID is
 * resolved against the `FloatingRateIndex` contracts the oracle seeds at
 * startup — callers don't need to know the template id.
 */
export async function exerciseProposalChoice(
  client: LedgerClient,
  args: {
    swapType: SwapType
    proposalContractId: string
    choiceKey: 'accept' | 'reject' | 'withdraw'
    extra?: Record<string, unknown>
  },
): Promise<{ workflowContractId?: string }> {
  const damlChoice = PROPOSAL_CHOICES[args.swapType][args.choiceKey]
  let choiceArgs: Record<string, unknown> = args.extra ?? {}
  if (args.choiceKey === 'accept') {
    const [operator, regulator] = await Promise.all([
      client.resolvePartyId('Operator'),
      client.resolvePartyId('Regulator'),
    ])
    // Demo profile resolves a single canonical regulator party. Real
    // multi-regulator deployments will replace this with a list resolved
    // from config (`orgs.filter(o => o.role === 'regulator')`).
    choiceArgs = { operator, regulators: [regulator], ...choiceArgs }
    if (args.swapType === 'IRS' || args.swapType === 'OIS' || args.swapType === 'ASSET') {
      const floatingRateIndexCid = await resolveFloatingRateIndexCid(client, 'USD')
      choiceArgs = { floatingRateIndexCid, ...choiceArgs }
    }
    if (args.swapType === 'BASIS') {
      const defaultLegs = SWAP_TYPE_CONFIGS.BASIS.defaultLegs
      const leg0IndexId = getLegIndexId(defaultLegs, 0) ?? 'USD-SOFR'
      const leg1IndexId = getLegIndexId(defaultLegs, 1) ?? 'USD-SOFR'
      const [leg0FloatingRateIndexCid, leg1FloatingRateIndexCid] = await Promise.all([
        resolveFloatingRateIndexCidByIndexId(client, leg0IndexId),
        resolveFloatingRateIndexCidByIndexId(client, leg1IndexId),
      ])
      choiceArgs = { leg0FloatingRateIndexCid, leg1FloatingRateIndexCid, ...choiceArgs }
    }
    if (args.swapType === 'XCCY') {
      // XCCY has one float leg (the second defaultLegs entry). The
      // XccyAccept choice enforces float-leg currency matching, so
      // resolving by indexId is enough — currency comes along for the ride.
      const defaultLegs = SWAP_TYPE_CONFIGS.XCCY.defaultLegs
      const floatIndexId = getLegIndexId(defaultLegs, 1) ?? 'EUR-ESTR'
      const floatFloatingRateIndexCid = await resolveFloatingRateIndexCidByIndexId(
        client,
        floatIndexId,
      )
      choiceArgs = { floatFloatingRateIndexCid, ...choiceArgs }
    }

    // Compliance gate: any family in manual mode routes through
    // <Family>ProposeAccept (a nonconsuming sister choice on the proposal)
    // instead of the direct Accept choice. The counterparty signs alone —
    // no operator actAs widening. Operator finalises via <Family>ConfirmAccept.
    const PROPOSE_ACCEPT_CHOICE: Record<string, string> = {
      IRS: 'IrsProposeAccept',
      OIS: 'OisProposeAccept',
      BASIS: 'BasisProposeAccept',
      XCCY: 'XccyProposeAccept',
      CDS: 'CdsProposeAccept',
      CCY: 'CcyProposeAccept',
      FX: 'FxProposeAccept',
      ASSET: 'AssetProposeAccept',
      FpML: 'FpmlProposeAccept',
    }
    const proposeAcceptChoice = PROPOSE_ACCEPT_CHOICE[args.swapType]
    if (proposeAcceptChoice) {
      const policy = await readOperatorPolicy(client, args.swapType)
      if (policy === 'manual') {
        await client.exercise(
          PROPOSAL_TEMPLATES[args.swapType],
          args.proposalContractId,
          proposeAcceptChoice,
          choiceArgs,
        )
        // No workflow contract created yet — operator must finalize separately.
        return { workflowContractId: undefined }
      }
    }
  }
  const raw = await client.exercise(
    PROPOSAL_TEMPLATES[args.swapType],
    args.proposalContractId,
    damlChoice,
    choiceArgs,
  )
  if (args.choiceKey === 'accept') {
    const exerciseResult = extractExerciseResult(raw)
    return { workflowContractId: typeof exerciseResult === 'string' ? exerciseResult : undefined }
  }
  return {}
}

/**
 * Exercise a choice on a `SwapWorkflow` contract. Requires the workflow
 * contract id captured from Accept or resolved via a subsequent query.
 */
export async function exerciseWorkflowChoice(
  client: LedgerClient,
  args: {
    workflowContractId: string | null
    choice: 'TriggerLifecycle' | 'Settle' | 'Terminate' | 'Mature'
    args: Record<string, unknown>
  },
): Promise<void> {
  if (!args.workflowContractId) {
    throw new Error('Missing workflow contract id — cannot exercise workflow choice')
  }
  await client.exercise(WORKFLOW_TEMPLATE, args.workflowContractId, args.choice, args.args)
}

export async function createTerminateProposal(
  client: LedgerClient,
  args: {
    operator: string
    proposer: string
    counterparty: string
    regulators: string[]
    workflowContractId: string
    proposedPvAmount: number
    reason: string
  },
): Promise<{ contractId: string }> {
  const payload = {
    operator: args.operator,
    proposer: args.proposer,
    counterparty: args.counterparty,
    regulators: args.regulators,
    workflowCid: args.workflowContractId,
    proposedPvAmount: args.proposedPvAmount.toFixed(2),
    reason: args.reason,
    proposedAt: new Date().toISOString(),
  }
  const result = await client.create('Swap.Terminate:TerminateProposal', payload)
  return { contractId: result.contractId }
}

export async function exerciseTerminateProposalChoice(
  client: LedgerClient,
  args: {
    proposalCid: string
    choice: 'TpAccept' | 'TpReject' | 'TpWithdraw'
    args: Record<string, unknown>
  },
): Promise<unknown> {
  return await client.exercise(
    'Swap.Terminate:TerminateProposal',
    args.proposalCid,
    args.choice,
    args.args,
  )
}

/**
 * JSON API shape: `{ result: { exerciseResult, events } }`. The
 * `LedgerClient.exercise` method returns the raw body; this helper narrows it.
 */
function extractExerciseResult(raw: unknown): unknown {
  if (raw && typeof raw === 'object' && 'result' in raw) {
    const inner = raw.result
    if (inner && typeof inner === 'object' && 'exerciseResult' in inner) {
      return inner.exerciseResult
    }
  }
  return undefined
}
