import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useConfig } from '@/shared/contexts/config-context'
import { useFlags } from '../use-flags'

vi.mock('@/shared/contexts/config-context', () => ({
  useConfig: vi.fn(),
}))

const mocked = vi.mocked(useConfig)

const minimalConfig = (scheduler?: { enabled: boolean; manualOverridesEnabled: boolean }) => ({
  config: scheduler ? ({ scheduler } as never) : ({} as never),
  loading: false,
  getOrg: () => undefined,
})

describe('useFlags', () => {
  beforeEach(() => mocked.mockReset())

  it('returns the wired scheduler flags from config', () => {
    mocked.mockReturnValue(minimalConfig({ enabled: true, manualOverridesEnabled: false }))
    const { result } = renderHook(() => useFlags())
    expect(result.current.schedulerEnabled).toBe(true)
    expect(result.current.schedulerManualOverridesEnabled).toBe(false)
  })

  it('defaults schedulerEnabled=false / manualOverridesEnabled=true when config has no scheduler block (legacy parity)', () => {
    mocked.mockReturnValue(minimalConfig())
    const { result } = renderHook(() => useFlags())
    expect(result.current.schedulerEnabled).toBe(false)
    expect(result.current.schedulerManualOverridesEnabled).toBe(true)
  })

  it('defaults to safe fallbacks when config is null (still loading)', () => {
    mocked.mockReturnValue({ config: null, loading: true, getOrg: () => undefined })
    const { result } = renderHook(() => useFlags())
    expect(result.current.schedulerEnabled).toBe(false)
    expect(result.current.schedulerManualOverridesEnabled).toBe(true)
  })
})
