import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'

import {
  isOperatorParty,
  isRegulatorParty,
  useIsOperator,
  useIsRegulator,
} from '../use-is-operator'

afterEach(() => cleanup())

const mockedRole = vi.fn(() => 'trader')
vi.mock('../use-active-org-role', () => ({
  useActiveOrgRole: () => mockedRole(),
}))

describe('useIsOperator', () => {
  test('returns true when role is operator', () => {
    mockedRole.mockReturnValue('operator')
    const { result } = renderHook(() => useIsOperator())
    expect(result.current).toBe(true)
  })

  test('returns false when role is trader', () => {
    mockedRole.mockReturnValue('trader')
    const { result } = renderHook(() => useIsOperator())
    expect(result.current).toBe(false)
  })

  test('returns false when role is regulator', () => {
    mockedRole.mockReturnValue('regulator')
    const { result } = renderHook(() => useIsOperator())
    expect(result.current).toBe(false)
  })
})

describe('useIsRegulator', () => {
  test('returns true when role is regulator', () => {
    mockedRole.mockReturnValue('regulator')
    const { result } = renderHook(() => useIsRegulator())
    expect(result.current).toBe(true)
  })

  test('returns false when role is trader or operator', () => {
    mockedRole.mockReturnValue('trader')
    expect(renderHook(() => useIsRegulator()).result.current).toBe(false)
    mockedRole.mockReturnValue('operator')
    expect(renderHook(() => useIsRegulator()).result.current).toBe(false)
  })
})

describe('isOperatorParty / isRegulatorParty', () => {
  test('isOperatorParty returns true for the bare Operator hint', () => {
    expect(isOperatorParty('Operator')).toBe(true)
  })

  test('isOperatorParty returns true for the full Operator party id (Hint::fingerprint)', () => {
    expect(isOperatorParty('Operator::abc123')).toBe(true)
  })

  test('isOperatorParty returns false for other parties', () => {
    expect(isOperatorParty('PartyA')).toBe(false)
    expect(isOperatorParty('PartyA::abc')).toBe(false)
    expect(isOperatorParty('Regulator')).toBe(false)
    expect(isOperatorParty(null)).toBe(false)
  })

  test('isRegulatorParty returns true for the bare Regulator hint', () => {
    expect(isRegulatorParty('Regulator')).toBe(true)
  })

  test('isRegulatorParty returns true for the full Regulator party id', () => {
    expect(isRegulatorParty('Regulator::xyz')).toBe(true)
  })

  test('isRegulatorParty returns false for other parties', () => {
    expect(isRegulatorParty('PartyA')).toBe(false)
    expect(isRegulatorParty('Operator')).toBe(false)
    expect(isRegulatorParty(null)).toBe(false)
  })
})
