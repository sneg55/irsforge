'use client'

import { PartyName } from 'canton-party-directory/ui'
import { ExportFpmlButton } from '@/features/fpml-export/export-button'
import { LedgerCidLink } from '@/features/ledger/components/ledger-cid-link'
import { useFlags } from '@/shared/flags/use-flags'
import type { SwapInstrumentPayload } from '@/shared/ledger/swap-instrument-types'
import { STATUS_ACTIONS, STATUS_COLORS } from '../constants'
import type { PendingUnwind } from '../hooks/use-workspace-reducer'
import type { StatusAction, SwapStatus, SwapType } from '../types'
import { RegulatorVisibilityPill } from './regulator-visibility-pill'

// Phase 6 Stage B — workflow choices the scheduler will fire automatically
// in production. The frontend hides these manual buttons when
// useFlags().schedulerManualOverridesEnabled === false (production
// profile); demo profile keeps them visible so a human can drive the
// demo end-to-end. Choices NOT in this set (Unwind, accept/reject/
// withdraw on proposals, terminateProposal accepts) are never
// scheduler-driven and stay always-visible.
const SCHEDULER_AUTO_CHOICES = new Set(['TriggerLifecycle', 'Settle', 'Mature'])

interface OnChainPanelProps {
  swapStatus: SwapStatus | null
  proposalRole: 'proposer' | 'counterparty' | null
  contractId: string | null
  counterparty: string
  /**
   * Count of Effect contracts currently awaiting Settle — i.e. cashflows
   * that TriggerLifecycle has produced but that haven't yet been allocated
   * and approved. Surfacing "outstanding" (rather than "done") is the only
   * semantic we can derive from the ledger without walking archive history:
   * settled Effects are gone from /v1/query, so a "done" counter would need
   * a dedicated field on SwapWorkflow.
   */
  fixingsOutstanding: number
  fixingsTotal: number
  nextFixingDate: string
  hasOutstandingEffects: boolean
  isPastMaturity: boolean
  isOperator: boolean
  swapType: SwapType
  /**
   * Whether price-feed observations for the ASSET swap family have been
   * provisioned by the oracle. When false, the TriggerLifecycle button
   * is rendered disabled with an explanatory tooltip.
   */
  assetObservablesEnabled: boolean
  pendingUnwind: PendingUnwind | null
  unwindRole: 'proposer' | 'counterparty' | null
  /**
   * On-chain instrument for Export FpML — null until `useSwapInstruments`
   * resolves or when the workflow isn't active yet.
   */
  workflowInstrument: SwapInstrumentPayload | null
  /**
   * Regulator parties on the resolved workflow. Drives the
   * "Regulator visible" pill near the cid; empty array hides the pill.
   */
  workflowRegulators: readonly string[]
  /** Scalar notional off the SwapWorkflow (IRS instrument doesn't carry it). */
  workflowNotional: string
  onExerciseAction: (
    action: StatusAction,
    extraArgs?: Record<string, unknown>,
  ) => Promise<void> | void
  onOpenUnwindModal: () => void
}

export function OnChainPanel({
  swapStatus,
  proposalRole,
  contractId,
  counterparty,
  fixingsOutstanding,
  fixingsTotal,
  nextFixingDate,
  hasOutstandingEffects,
  isPastMaturity,
  isOperator,
  swapType,
  assetObservablesEnabled,
  pendingUnwind,
  unwindRole,
  workflowInstrument,
  workflowRegulators,
  workflowNotional,
  onExerciseAction,
  onOpenUnwindModal,
}: OnChainPanelProps) {
  const { schedulerManualOverridesEnabled } = useFlags()
  const statusKey =
    pendingUnwind && unwindRole
      ? `PendingUnwind_${unwindRole}`
      : swapStatus === 'Proposed' && proposalRole
        ? `Proposed_${proposalRole}`
        : (swapStatus ?? '')

  return (
    <div className="p-3.5 border-b border-[#1e2235]">
      <div className="flex items-center gap-1 text-3xs font-semibold tracking-wider text-[#8b5cf6] mb-2">
        <div className="w-[3px] h-2.5 rounded-sm bg-[#8b5cf6]" />
        ON-CHAIN
      </div>
      {/* Status */}
      <div className="flex items-center gap-1.5 mb-2">
        <div
          className="w-2 h-2 rounded-full"
          style={{
            background:
              swapStatus === 'Active'
                ? '#22c55e'
                : swapStatus === 'Proposed'
                  ? '#f59e0b'
                  : '#555b6e',
            boxShadow: swapStatus === 'Active' ? '0 0 6px #22c55e' : 'none',
          }}
        />
        <span
          className={`text-2xs font-semibold ${STATUS_COLORS[swapStatus ?? ''] ?? 'text-[#555b6e]'}`}
          data-tooltip-key={swapStatus === 'Active' ? 'status-active' : undefined}
          title={
            swapStatus === 'Active'
              ? 'On-chain status: this swap is live and accruing under the Master Agreement.'
              : undefined
          }
        >
          {swapStatus ?? 'UNKNOWN'}
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          <RegulatorVisibilityPill regulators={workflowRegulators} />
          {contractId && (
            <LedgerCidLink
              cid={contractId}
              truncate={12}
              className="text-3xs text-[#555b6e] hover:text-[#8a9dc5]"
            />
          )}
        </span>
      </div>
      {/* Details */}
      <div className="grid gap-1 text-3xs mb-2">
        <div className="flex justify-between">
          <span className="text-[#555b6e]">Counterparty</span>
          <span className="text-white font-mono">
            {counterparty ? <PartyName identifier={counterparty} /> : '—'}
          </span>
        </div>
        <div className="flex justify-between">
          <span
            className="text-[#555b6e]"
            data-tooltip-key="next-fixing"
            title="The next scheduled rate fixing date for this swap's float leg."
          >
            Next Fixing
          </span>
          <span className="text-[#f59e0b] font-mono">{nextFixingDate}</span>
        </div>
        <div className="flex justify-between">
          <span
            className="text-[#555b6e]"
            data-tooltip-key="outstanding"
            title="On-chain Effects awaiting Settle — fixings produced but not yet cash-settled."
          >
            Outstanding
          </span>
          {/* Amber when a fixing has been triggered but not yet settled —
             this is the UI's call-to-action for Settle. */}
          <span className={`font-mono ${fixingsOutstanding > 0 ? 'text-[#f59e0b]' : 'text-white'}`}>
            {fixingsOutstanding} / {fixingsTotal}
          </span>
        </div>
      </div>
      {/* Pending Unwind Summary */}
      {pendingUnwind && (
        <div className="mb-3 p-2 border border-[#f59e0b]/40 bg-[#f59e0b]/5 text-2xs">
          <div className="text-[#f59e0b] font-semibold mb-1">PENDING UNWIND</div>
          <div className="text-[#8b8fa3]">
            {pendingUnwind.proposer.split('::')[0]}: ${pendingUnwind.pvAmount.toLocaleString()} ·{' '}
            {pendingUnwind.reason}
          </div>
        </div>
      )}
      {/* Action buttons */}
      <div className="flex flex-col gap-1.5">
        {(STATUS_ACTIONS[statusKey] ?? [])
          .filter(
            (action) =>
              !(action.target === 'workflow' && action.operatorOnly && !isOperator) &&
              // Trader-controllered choices: proposal Accept/Reject/Withdraw
              // and terminateProposal Unwind/TpAccept/TpReject/TpWithdraw all
              // have controller=partyA|partyB on-chain. Operator clicking
              // would trigger DAML_AUTHORIZATION_ERROR — hide instead.
              !(
                isOperator &&
                (action.target === 'proposal' || action.target === 'terminateProposal')
              ) &&
              !(
                action.target === 'workflow' &&
                action.choice === 'Settle' &&
                !hasOutstandingEffects
              ) &&
              !(action.target === 'workflow' && action.choice === 'Mature' && !isPastMaturity) &&
              // Phase 6 Stage B: hide scheduler-driven choices when manual
              // overrides are disabled (production profile). Other workflow
              // choices (Unwind via terminateProposal) stay visible.
              !(
                action.target === 'workflow' &&
                SCHEDULER_AUTO_CHOICES.has(action.choice) &&
                !schedulerManualOverridesEnabled
              ),
          )
          .map((action) => {
            // Disable TriggerLifecycle for ASSET swaps until the oracle
            // publishes price feeds — otherwise the lifecycle rule would
            // fail to find any Observation contracts and throw.
            const disableAssetLifecycle =
              action.target === 'workflow' &&
              action.choice === 'TriggerLifecycle' &&
              swapType === 'ASSET' &&
              !assetObservablesEnabled
            return (
              <button
                key={`${action.target}:${action.choice}`}
                disabled={disableAssetLifecycle}
                title={disableAssetLifecycle ? 'Asset price feeds not yet provisioned.' : undefined}
                onClick={async () => {
                  if (disableAssetLifecycle) return
                  try {
                    if (action.target === 'terminateProposal' && action.choice === 'propose') {
                      onOpenUnwindModal()
                      return
                    }
                    await onExerciseAction(action)
                  } catch (err) {
                    alert(err instanceof Error ? err.message : 'Action failed')
                  }
                }}
                className={`w-full py-2 rounded text-2xs font-semibold tracking-wider transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  action.variant === 'primary'
                    ? 'bg-[#8b5cf6] text-white hover:bg-[#7c3aed]'
                    : action.variant === 'secondary'
                      ? 'bg-transparent text-[#f59e0b] border border-[#f59e0b]/30 hover:border-[#f59e0b]/60'
                      : 'bg-transparent text-[#555b6e] border border-[#1e2235] hover:text-[#8b8fa3]'
                }`}
              >
                {action.label}
              </button>
            )
          })}
        {swapStatus === 'Active' && (
          <ExportFpmlButton
            swapType={swapType}
            notional={workflowNotional}
            instrument={workflowInstrument}
            workflowContractId={contractId}
          />
        )}
      </div>
    </div>
  )
}
