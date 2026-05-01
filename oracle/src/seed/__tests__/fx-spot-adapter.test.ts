import { describe, expect, it, vi } from 'vitest'
import type { LedgerClient } from '../../shared/ledger-client.js'
import { fxSpotLedgerAdapter } from '../index.js'

const parties = {
  operator: 'Operator::x',
  partyA: 'PartyA::x',
  partyB: 'PartyB::x',
  regulators: ['Regulator::x'],
}

function makeClient(rows: unknown[] = []) {
  const query = vi.fn().mockResolvedValue(rows)
  const create = vi.fn().mockResolvedValue({ contractId: 'cid-1' })
  const exercise = vi.fn().mockResolvedValue({})
  return { query, create, exercise } as unknown as LedgerClient & {
    query: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    exercise: ReturnType<typeof vi.fn>
  }
}

describe('fxSpotLedgerAdapter', () => {
  it('listFxSpots normalizes string and number rates', async () => {
    const client = makeClient([
      { contractId: 'c1', payload: { baseCcy: 'USD', quoteCcy: 'EUR', rate: '0.92' } },
      { contractId: 'c2', payload: { baseCcy: 'USD', quoteCcy: 'JPY', rate: 150.25 } },
    ])
    const adapter = fxSpotLedgerAdapter(client, parties)
    const rows = await adapter.listFxSpots()
    expect(rows).toEqual([
      { contractId: 'c1', baseCcy: 'USD', quoteCcy: 'EUR', rate: 0.92 },
      { contractId: 'c2', baseCcy: 'USD', quoteCcy: 'JPY', rate: 150.25 },
    ])
  })

  it('createFxSpot serializes rate as string and asOf as ISO', async () => {
    const client = makeClient()
    const adapter = fxSpotLedgerAdapter(client, parties)
    const asOf = new Date('2026-04-20T10:00:00Z')
    await adapter.createFxSpot({ baseCcy: 'USD', quoteCcy: 'EUR', rate: 0.92, asOf })
    expect(client.create).toHaveBeenCalledTimes(1)
    const call = client.create.mock.calls[0][0] as {
      templateId: string
      payload: Record<string, unknown>
    }
    expect(call.payload.rate).toBe('0.92')
    expect(call.payload.asOf).toBe(asOf.toISOString())
    expect(call.payload.operator).toBe(parties.operator)
    expect(call.payload.subscribers).toEqual([parties.partyA, parties.partyB])
  })

  it('updateFxSpotRate targets the UpdateRate choice with stringified args', async () => {
    const client = makeClient()
    const adapter = fxSpotLedgerAdapter(client, parties)
    const newAsOf = new Date('2026-04-21T10:00:00Z')
    await adapter.updateFxSpotRate({ contractId: 'c1', newRate: 0.93, newAsOf })
    expect(client.exercise).toHaveBeenCalledTimes(1)
    const call = client.exercise.mock.calls[0][0] as {
      choice: string
      contractId: string
      argument: { newRate: string; newAsOf: string }
    }
    expect(call.choice).toBe('UpdateRate')
    expect(call.contractId).toBe('c1')
    expect(call.argument).toEqual({ newRate: '0.93', newAsOf: newAsOf.toISOString() })
  })
})
