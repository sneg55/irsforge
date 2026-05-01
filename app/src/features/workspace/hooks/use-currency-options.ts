'use client'

import { useMemo } from 'react'
import { useConfig } from '@/shared/contexts/config-context'

export interface CurrencyOption {
  label: string
  value: string
}

/**
 * Currency options for leg editors — sourced from resolved config so the UI
 * can only offer currencies that are actually seeded on-chain. Returns an
 * empty list while config is loading; upstream workspace gating keeps the
 * edit surface hidden until config resolves.
 */
export function useCurrencyOptions(): CurrencyOption[] {
  const { config } = useConfig()
  return useMemo(
    () =>
      (config?.currencies ?? []).map((c) => ({
        label: c.code,
        value: c.code,
      })),
    [config?.currencies],
  )
}
