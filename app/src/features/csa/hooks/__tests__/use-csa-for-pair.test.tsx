import { renderHook } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import { useCsaForPair } from '../use-csa-for-pair'

import { useCsas } from '../use-csas'

vi.mock('../use-csas', () => ({
  useCsas: vi.fn(),
}))

const mock = useCsas as unknown as ReturnType<typeof vi.fn>

function vm(partyA: string, partyB: string) {
  return {
    contractId: 'c',
    operator: 'O',
    partyA,
    partyB,
    regulators: ['R'],
    thresholdDirA: 0,
    thresholdDirB: 0,
    mta: 0,
    rounding: 0,
    valuationCcy: 'USD',
    postedByA: new Map(),
    postedByB: new Map(),
    state: 'Active' as const,
    lastMarkCid: null,
    activeDispute: null,
    isdaMasterAgreementRef: '',
    governingLaw: 'NewYork' as const,
    imAmount: 0,
  }
}

describe('useCsaForPair', () => {
  test('matches when party fragments are contained in the full party IDs', () => {
    mock.mockReturnValue({ data: [vm('Alice::fp', 'Bob::fp')] })
    const { result } = renderHook(() => useCsaForPair('alice', 'bob'))
    expect(result.current?.partyA).toBe('Alice::fp')
  })

  test('matches reverse order', () => {
    mock.mockReturnValue({ data: [vm('Alice::fp', 'Bob::fp')] })
    const { result } = renderHook(() => useCsaForPair('bob', 'alice'))
    expect(result.current?.partyB).toBe('Bob::fp')
  })

  test('returns null when no pair matches', () => {
    mock.mockReturnValue({ data: [vm('Alice::fp', 'Bob::fp')] })
    const { result } = renderHook(() => useCsaForPair('carol', 'dave'))
    expect(result.current).toBeNull()
  })
})
