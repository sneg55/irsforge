import { describe, expect, it, vi } from 'vitest'

const mockResolveTriggerLifecycleInputs = vi.fn()
const mockExerciseWorkflowChoice = vi.fn()

vi.mock('@/features/workspace/ledger/trigger-lifecycle-inputs', () => ({
  resolveTriggerLifecycleInputs: (...args: unknown[]) => mockResolveTriggerLifecycleInputs(...args),
  TriggerLifecycleError: class TriggerLifecycleError extends Error {},
}))

vi.mock('@/features/workspace/ledger/swap-actions', () => ({
  exerciseWorkflowChoice: (...args: unknown[]) => mockExerciseWorkflowChoice(...args),
}))

import { manualTriggerLifecycle } from './manual-lifecycle'

const fakeClient = {} as Parameters<typeof manualTriggerLifecycle>[0]

describe('manualTriggerLifecycle', () => {
  it('calls resolveTriggerLifecycleInputs then exerciseWorkflowChoice', async () => {
    const inputs = { lifecycleRuleCid: 'rule-cid', eventCid: 'event-cid', observableCids: [] }
    mockResolveTriggerLifecycleInputs.mockResolvedValue(inputs)
    mockExerciseWorkflowChoice.mockResolvedValue(undefined)

    await manualTriggerLifecycle(fakeClient, { swapContractId: 'swap-123' })

    expect(mockResolveTriggerLifecycleInputs).toHaveBeenCalledWith(
      fakeClient,
      expect.objectContaining({ swapType: 'CCY' }),
    )
    expect(mockExerciseWorkflowChoice).toHaveBeenCalledWith(
      fakeClient,
      expect.objectContaining({
        workflowContractId: 'swap-123',
        choice: 'TriggerLifecycle',
        args: inputs,
      }),
    )
  })

  it('uses provided eventDate rather than today when given', async () => {
    const inputs = { lifecycleRuleCid: 'r', eventCid: 'e', observableCids: [] }
    mockResolveTriggerLifecycleInputs.mockResolvedValue(inputs)
    mockExerciseWorkflowChoice.mockResolvedValue(undefined)

    await manualTriggerLifecycle(fakeClient, {
      swapContractId: 'swap-456',
      eventDate: '2026-04-01',
    })

    expect(mockResolveTriggerLifecycleInputs).toHaveBeenCalledWith(
      fakeClient,
      expect.objectContaining({ eventDate: '2026-04-01' }),
    )
  })

  it('propagates errors from resolveTriggerLifecycleInputs', async () => {
    mockResolveTriggerLifecycleInputs.mockRejectedValue(new Error('no cash record'))
    await expect(
      manualTriggerLifecycle(fakeClient, { swapContractId: 'swap-789' }),
    ).rejects.toThrow('no cash record')
  })
})
