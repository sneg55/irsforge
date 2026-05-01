import type { LedgerClient } from '@/shared/ledger/client'
import { PROPOSAL_DELEGATION_TEMPLATE_ID } from '@/shared/ledger/template-ids'
import type { SwapType } from '../types'

/**
 * Resolve the operator-signed ProposalDelegation contract that lets
 * traders create proposals using only their own party authority. The
 * delegation is created once per operator at sandbox bootstrap (see
 * `Setup.InitImpl.initForParties`).
 *
 * Throws if no delegation is on-ledger for the given operator — that's
 * a Setup.Init misconfiguration, not a recoverable runtime state.
 */
export async function resolveProposalDelegationCid(
  client: LedgerClient,
  operator: string,
): Promise<string> {
  const rows = await client.query<{
    contractId: string
    payload: { operator?: string }
  }>(PROPOSAL_DELEGATION_TEMPLATE_ID)
  const match = rows.find((r) => r.payload?.operator === operator)
  if (!match) {
    throw new Error('No ProposalDelegation seeded for operator — did Setup.Init complete?')
  }
  return match.contractId
}

/**
 * JSON API exercise result envelope: `{result:{exerciseResult,events}}`.
 * `Create*Proposal` choices return the new proposal's ContractId as
 * a Text in `exerciseResult`.
 */
export function extractCreatedProposalCid(raw: unknown): string | undefined {
  if (!raw || typeof raw !== 'object' || !('result' in raw)) return undefined
  const r = (raw as { result: unknown }).result
  if (!r || typeof r !== 'object') return undefined
  if ('exerciseResult' in r && typeof r.exerciseResult === 'string') {
    return r.exerciseResult
  }
  return undefined
}

/**
 * Per-family mapping from a `buildProposalPayload` payload to the
 * `Create<Family>Proposal` choice name + its argument set. The choice
 * arg shape excludes `operator` (carried by the delegation contract);
 * everything else mirrors the proposal template's `with` block in
 * `contracts/src/Swap/<Family>Proposal.daml`.
 */
type Payload = Record<string, unknown>
type DelegationDispatch = { choice: string; args: Payload }

export function delegationDispatchFor(
  swapType: SwapType,
  proposer: string,
  counterparty: string,
  payload: Payload,
): DelegationDispatch {
  switch (swapType) {
    case 'IRS':
      return {
        choice: 'CreateSwapProposal',
        args: {
          proposer,
          counterparty,
          notional: payload.notional,
          fixRate: payload.fixRate,
          tenor: payload.tenor,
          startDate: payload.startDate,
          dayCountConvention: payload.dayCountConvention,
        },
      }
    case 'OIS':
      return {
        choice: 'CreateOisProposal',
        args: {
          proposer,
          counterparty,
          notional: payload.notional,
          fixRate: payload.fixRate,
          startDate: payload.startDate,
          maturityDate: payload.maturityDate,
          dayCountConvention: payload.dayCountConvention,
        },
      }
    case 'BASIS':
      return {
        choice: 'CreateBasisSwapProposal',
        args: {
          proposer,
          counterparty,
          notional: payload.notional,
          currency: payload.currency,
          leg0Spread: payload.leg0Spread,
          leg1Spread: payload.leg1Spread,
          startDate: payload.startDate,
          maturityDate: payload.maturityDate,
          dayCountConvention: payload.dayCountConvention,
        },
      }
    case 'XCCY':
      return {
        choice: 'CreateXccyFixedFloatProposal',
        args: {
          proposer,
          counterparty,
          fixedCurrency: payload.fixedCurrency,
          fixedNotional: payload.fixedNotional,
          fixedRate: payload.fixedRate,
          floatCurrency: payload.floatCurrency,
          floatNotional: payload.floatNotional,
          startDate: payload.startDate,
          maturityDate: payload.maturityDate,
          dayCountConvention: payload.dayCountConvention,
        },
      }
    case 'CDS':
      return {
        choice: 'CreateCdsProposal',
        args: {
          proposer,
          counterparty,
          notional: payload.notional,
          fixRate: payload.fixRate,
          referenceName: payload.referenceName,
          ownerReceivesFix: payload.ownerReceivesFix,
          startDate: payload.startDate,
          maturityDate: payload.maturityDate,
          dayCountConvention: payload.dayCountConvention,
        },
      }
    case 'CCY':
      return {
        choice: 'CreateCcySwapProposal',
        args: {
          proposer,
          counterparty,
          notional: payload.notional,
          baseRate: payload.baseRate,
          foreignRate: payload.foreignRate,
          baseCurrency: payload.baseCurrency,
          foreignCurrency: payload.foreignCurrency,
          fxRate: payload.fxRate,
          ownerReceivesBase: payload.ownerReceivesBase,
          startDate: payload.startDate,
          maturityDate: payload.maturityDate,
          dayCountConvention: payload.dayCountConvention,
        },
      }
    case 'FX':
      return {
        choice: 'CreateFxSwapProposal',
        args: {
          proposer,
          counterparty,
          notional: payload.notional,
          baseCurrency: payload.baseCurrency,
          foreignCurrency: payload.foreignCurrency,
          firstFxRate: payload.firstFxRate,
          finalFxRate: payload.finalFxRate,
          firstPaymentDate: payload.firstPaymentDate,
          maturityDate: payload.maturityDate,
        },
      }
    case 'ASSET':
      return {
        choice: 'CreateAssetSwapProposal',
        args: {
          proposer,
          counterparty,
          notional: payload.notional,
          fixRate: payload.fixRate,
          ownerReceivesRate: payload.ownerReceivesRate,
          underlyingAssetIds: payload.underlyingAssetIds,
          underlyingWeights: payload.underlyingWeights,
          startDate: payload.startDate,
          maturityDate: payload.maturityDate,
          dayCountConvention: payload.dayCountConvention,
        },
      }
    case 'FpML':
      return {
        choice: 'CreateFpmlProposal',
        args: {
          proposer,
          counterparty,
          legs: payload.legs,
          startDate: payload.startDate,
          maturityDate: payload.maturityDate,
          description: payload.description,
        },
      }
  }
}
