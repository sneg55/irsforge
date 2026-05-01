import type { LedgerClient } from '@/shared/ledger/client'
import type { EligibleCollateralPayload, GoverningLaw } from '@/shared/ledger/csa-types'
import { CSA_PROPOSAL_TEMPLATE_ID } from '@/shared/ledger/template-ids'

export interface ProposeCsaArgs {
  proposerHint: string
  counterpartyHint: string
  thresholdDirA: number
  thresholdDirB: number
  mta: number
  rounding: number
  eligible: EligibleCollateralPayload[]
  valuationCcy: string
  isdaMasterAgreementRef: string
  governingLaw: GoverningLaw
  imAmount: number
}

/**
 * Create a `CsaProposal` contract on the ledger. The template requires
 * `proposer` and `operator` as co-signatories, so both are listed in
 * `actAs`. Full party fingerprints (not bare hints) are resolved via
 * `client.resolvePartyId` per the project memory rule
 * `feedback_hint_vs_full_id_for_choice_args.md`.
 *
 * Daml `Decimal` fields are serialized as strings per Canton JSON API
 * conventions — the same pattern used in `swap-actions.ts`.
 */
export async function proposeCsa(
  client: LedgerClient,
  args: ProposeCsaArgs,
): Promise<{ contractId: string }> {
  const [proposer, counterparty, operator, regulator] = await Promise.all([
    client.resolvePartyId(args.proposerHint),
    client.resolvePartyId(args.counterpartyHint),
    client.resolvePartyId('Operator'),
    client.resolvePartyId('Regulator'),
  ])

  const payload = {
    operator,
    // Demo profile resolves the singleton canonical regulator party. Real
    // multi-regulator deployments will replace this with a list resolved
    // from config (`orgs.filter(o => o.role === 'regulator')`).
    regulators: [regulator],
    proposer,
    counterparty,
    thresholdDirA: args.thresholdDirA.toString(),
    thresholdDirB: args.thresholdDirB.toString(),
    mta: args.mta.toString(),
    rounding: args.rounding.toString(),
    eligible: args.eligible,
    valuationCcy: args.valuationCcy,
    isdaMasterAgreementRef: args.isdaMasterAgreementRef,
    governingLaw: args.governingLaw,
    imAmount: args.imAmount.toString(),
  }

  const created = await client.create(CSA_PROPOSAL_TEMPLATE_ID, payload, {
    actAs: [proposer, operator],
  })
  return { contractId: created.contractId }
}

/**
 * Exercise a choice on a `CsaProposal` contract.
 *
 * - `accept`: counterparty accepts; requires a `scheduler` party arg (full
 *   fingerprint resolved via `resolvePartyId`).
 * - `reject`: counterparty rejects; no extra args.
 * - `withdraw`: proposer withdraws; no extra args.
 */
export async function exerciseCsaProposalChoice(
  client: LedgerClient,
  contractId: string,
  choice: 'accept' | 'reject' | 'withdraw',
): Promise<void> {
  const choiceName =
    choice === 'accept'
      ? 'CsaProposalAccept'
      : choice === 'reject'
        ? 'CsaProposalReject'
        : 'CsaProposalWithdraw'

  let choiceArgs: Record<string, unknown> = {}
  if (choice === 'accept') {
    const scheduler = await client.resolvePartyId('Scheduler')
    choiceArgs = { scheduler }
  }

  await client.exercise(CSA_PROPOSAL_TEMPLATE_ID, contractId, choiceName, choiceArgs)
}
