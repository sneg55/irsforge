import { describe, expect, test, vi } from 'vitest'
import type { LedgerClient } from '@/shared/ledger/client'
import {
  BASIS_ACCEPT_ACK_TEMPLATE_ID,
  CDS_ACCEPT_ACK_TEMPLATE_ID,
  IRS_ACCEPT_ACK_TEMPLATE_ID,
} from '@/shared/ledger/template-ids'
import { confirmAccept } from './confirm-accept'

function makeMockClient(): LedgerClient {
  return {
    exercise: vi.fn(() => Promise.resolve({})),
  } as unknown as LedgerClient
}

describe('confirmAccept', () => {
  test('IRS — calls exercise with IrsConfirmAccept and IRS template id', async () => {
    const client = makeMockClient()
    await confirmAccept(client, { family: 'IRS', ackContractId: 'irs-ack-1' })

    expect(client.exercise).toHaveBeenCalledWith(
      IRS_ACCEPT_ACK_TEMPLATE_ID,
      'irs-ack-1',
      'IrsConfirmAccept',
      {},
    )
  })

  test('CDS — calls exercise with CdsConfirmAccept and CDS template id', async () => {
    const client = makeMockClient()
    await confirmAccept(client, { family: 'CDS', ackContractId: 'cds-ack-42' })

    expect(client.exercise).toHaveBeenCalledWith(
      CDS_ACCEPT_ACK_TEMPLATE_ID,
      'cds-ack-42',
      'CdsConfirmAccept',
      {},
    )
  })

  test('BASIS — calls exercise with BasisConfirmAccept and BASIS template id', async () => {
    const client = makeMockClient()
    await confirmAccept(client, { family: 'BASIS', ackContractId: 'basis-ack-7' })

    expect(client.exercise).toHaveBeenCalledWith(
      BASIS_ACCEPT_ACK_TEMPLATE_ID,
      'basis-ack-7',
      'BasisConfirmAccept',
      {},
    )
  })

  test('FpML — choice name is FpmlConfirmAccept (not FpMLConfirmAccept)', async () => {
    const client = makeMockClient()
    await confirmAccept(client, { family: 'FpML', ackContractId: 'fpml-ack-1' })

    const call = (client.exercise as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[2]).toBe('FpmlConfirmAccept')
  })
})
