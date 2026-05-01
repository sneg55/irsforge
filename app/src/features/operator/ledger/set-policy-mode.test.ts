import { describe, expect, test, vi } from 'vitest'
import type { LedgerClient } from '@/shared/ledger/client'
import { setOperatorPolicyMode } from './set-policy-mode'

vi.mock('@/shared/ledger/generated/package-ids', () => ({
  IRSFORGE_PACKAGE_ID: 'test-pkg',
  DAML_FINANCE_DATA_PACKAGE_ID: 'test-data',
  DAML_FINANCE_LIFECYCLE_PACKAGE_ID: 'test-lifecycle',
  DAML_FINANCE_HOLDING_PACKAGE_ID: 'test-holding',
  DAML_FINANCE_CLAIMS_PACKAGE_ID: 'test-claims',
  DAML_FINANCE_INSTRUMENT_SWAP_PACKAGE_ID: 'test-swap',
}))

describe('setOperatorPolicyMode', () => {
  test('exercises SetMode with Manual when newMode=manual', async () => {
    const exercise = vi.fn().mockResolvedValue({ result: { exerciseResult: 'cid-2', events: [] } })
    const client = { exercise } as unknown as LedgerClient
    await setOperatorPolicyMode(client, { contractId: 'cid-1', newMode: 'manual' })
    expect(exercise).toHaveBeenCalledTimes(1)
    const [tpl, cid, choice, args] = exercise.mock.calls[0]
    expect(tpl).toContain('Operator.Policy:OperatorPolicy')
    expect(cid).toBe('cid-1')
    expect(choice).toBe('SetMode')
    expect(args).toEqual({ newMode: 'Manual' })
  })

  test('exercises SetMode with Auto when newMode=auto', async () => {
    const exercise = vi.fn().mockResolvedValue({ result: { exerciseResult: 'cid-2', events: [] } })
    const client = { exercise } as unknown as LedgerClient
    await setOperatorPolicyMode(client, { contractId: 'cid-1', newMode: 'auto' })
    const [, , choice, args] = exercise.mock.calls[0]
    expect(choice).toBe('SetMode')
    expect(args).toEqual({ newMode: 'Auto' })
  })
})
