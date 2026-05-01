'use client'

import { useOperatorPolicies } from '@/features/operator/hooks/use-operator-policies'
import type { OperatorPolicyMode, SwapFamily } from './client'

export type { OperatorPolicyMode, SwapFamily }

/**
 * Returns the operator co-sign policy mode for the given swap family from
 * the on-ledger `OperatorPolicy` contracts seeded at bootstrap. Falls back
 * to 'auto' while the query is loading or when no contract exists for the
 * family — a conservative default that keeps the swap pipeline open.
 */
export function useOperatorPolicy(family: SwapFamily): OperatorPolicyMode {
  const { rows } = useOperatorPolicies()
  return rows.find((r) => r.family === family)?.mode ?? 'auto'
}
