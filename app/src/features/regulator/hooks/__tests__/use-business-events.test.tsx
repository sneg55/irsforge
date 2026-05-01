import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useBusinessEvents } from '../use-business-events'

const mockEvents = [
  {
    kind: 'create',
    templateId: 'pkg:Swap.Workflow:SwapWorkflow',
    contractId: 'wf1',
    party: null,
    ts: 1700000000,
    payload: { swapType: 'IRS', partyA: 'PartyA', partyB: 'PartyB', notional: '100.0' },
  },
  {
    kind: 'create',
    templateId: 'pkg:Random.Module:Other',
    contractId: 'r1',
    party: null,
    ts: 1700000001,
    payload: {},
  },
  {
    kind: 'create',
    templateId: 'pkg:Csa.Mark:MarkToMarket',
    contractId: 'mk1',
    party: null,
    ts: 1700000002,
    payload: { partyA: 'PartyA', partyB: 'PartyB', asOf: 'now', exposure: '500.0' },
  },
]

vi.mock('@/features/ledger/contexts/ledger-activity-provider', () => ({
  useLedgerActivityContext: () => ({
    events: mockEvents,
    enabled: true,
    denyPrefixes: [],
    allowPrefixes: [],
    systemPrefixes: [],
    phase: 'streaming',
  }),
}))

describe('useBusinessEvents', () => {
  it('pipes the activity buffer through decode and drops nulls', () => {
    const { result } = renderHook(() => useBusinessEvents())
    expect(result.current.events.length).toBe(2)
    expect(result.current.events.map((e) => e.kind)).toEqual(['TradeAccepted', 'MarkPosted'])
  })
})
