import { describe, expect, it, vi } from 'vitest'
import { exerciseProviderChoice } from '../onchain-publisher.js'

describe('exerciseProviderChoice', () => {
  it('routes the call through the interface template id', async () => {
    const exercise = vi.fn().mockResolvedValue({ skipped: false })
    const client = { exercise } as unknown as Parameters<typeof exerciseProviderChoice>[0]
    await exerciseProviderChoice(client, {
      interfaceTemplateId: 'pkg:Oracle.Interface:Provider',
      contractId: 'cid#1',
      choice: 'Provider_PublishRate',
      argument: { args: { rateId: 'SOFR/ON', effectiveDate: '2026-04-25', value: '0.05' } },
    })
    expect(exercise).toHaveBeenCalledWith({
      templateId: 'pkg:Oracle.Interface:Provider',
      contractId: 'cid#1',
      choice: 'Provider_PublishRate',
      argument: { args: { rateId: 'SOFR/ON', effectiveDate: '2026-04-25', value: '0.05' } },
    })
  })

  it('forwards the resolved exercise result to the caller', async () => {
    const exercise = vi.fn().mockResolvedValue({ events: [{ type: 'created' }] })
    const client = { exercise } as unknown as Parameters<typeof exerciseProviderChoice>[0]
    const result = await exerciseProviderChoice(client, {
      interfaceTemplateId: 't',
      contractId: 'c',
      choice: 'Provider_PublishDiscountCurve',
      argument: {},
    })
    expect(result).toEqual({ events: [{ type: 'created' }] })
  })
})
