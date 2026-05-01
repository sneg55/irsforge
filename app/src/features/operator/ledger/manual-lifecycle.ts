import { exerciseWorkflowChoice } from '@/features/workspace/ledger/swap-actions'
import {
  resolveTriggerLifecycleInputs,
  TriggerLifecycleError,
} from '@/features/workspace/ledger/trigger-lifecycle-inputs'
import type { LedgerClient } from '@/shared/ledger/client'

export interface ManualLifecycleArgs {
  /** SwapWorkflow contract id to trigger. */
  swapContractId: string
  /** ISO date string (YYYY-MM-DD) for the fixing event. Defaults to today if omitted. */
  eventDate?: string
}

export { TriggerLifecycleError }

/**
 * Operator manual fallback for lifecycle triggering when the scheduler
 * is stalled. Resolves the CashSetupRecord + creates a DateClockUpdateEvent
 * via resolveTriggerLifecycleInputs (CCY/FX/FpML families — no external
 * observations). Then exercises TriggerLifecycle on the target workflow.
 *
 * NOTE: observableCids is empty — this is only suitable for families that
 * do not require rate observations (CCY, FX, FpML). IRS/CDS manual
 * triggers must still go through the workspace's full trigger flow.
 *
 * TODO(Task 12 follow-up): Accept swapType + observablesConfig to enable
 * IRS/CDS observation resolution via the same resolveTriggerLifecycleInputs
 * path.
 */
export async function manualTriggerLifecycle(
  client: LedgerClient,
  args: ManualLifecycleArgs,
): Promise<void> {
  const eventDate = args.eventDate ?? new Date().toISOString().split('T')[0]

  // Resolve only the infrastructure CIDs; skip observation lookup by
  // using CCY (zero-observable) as the swapType sentinel.
  const inputs = await resolveTriggerLifecycleInputs(client, {
    swapType: 'CCY',
    instrument: null,
    observablesConfig: {
      IRS: { rateIds: [], kind: 'periodic-fixing', enabled: false },
      OIS: { rateIds: [], kind: 'periodic-fixing', enabled: false },
      BASIS: { rateIds: [], kind: 'periodic-fixing', enabled: false },
      XCCY: { rateIds: [], kind: 'periodic-fixing', enabled: false },
      CDS: { rateIdPattern: '', kind: 'credit-event', enabled: false },
      CCY: { rateIds: [], kind: 'none', enabled: true },
      FX: { rateIds: [], kind: 'none', enabled: true },
      ASSET: { rateIdPattern: '', kind: 'price', enabled: false },
      FpML: { rateIds: [], kind: 'embedded', enabled: true },
    },
    eventDate,
  })

  await exerciseWorkflowChoice(client, {
    workflowContractId: args.swapContractId,
    choice: 'TriggerLifecycle',
    args: inputs as unknown as Record<string, unknown>,
  })
}
