import type { LedgerClient } from '@/shared/ledger/client'
import { OPERATOR_POLICY_TEMPLATE_ID } from '@/shared/ledger/template-ids'
import type { OperatorPolicyMode, SwapFamily } from './client'

export type { OperatorPolicyMode, SwapFamily }

interface OperatorPolicyDamlPayload {
  operator: string
  regulators: string[]
  traders: string[]
  family: string
  mode: 'Auto' | 'Manual'
}

/**
 * Non-hook accessor for the on-ledger `OperatorPolicy` contract for a
 * given swap family. Used by ledger action functions (e.g. `proposeSwap`)
 * that decide between Accept and ProposeAccept before exercising a
 * proposal choice. Falls back to 'auto' when no contract exists for the
 * family — bootstrap seeds 9, but a profile may publish fewer.
 */
export async function readOperatorPolicy(
  client: LedgerClient,
  family: SwapFamily,
): Promise<OperatorPolicyMode> {
  const raw = await client.query<{ payload: OperatorPolicyDamlPayload }>(
    OPERATOR_POLICY_TEMPLATE_ID,
  )
  const match = raw.find((r) => r.payload.family === family)
  if (!match) return 'auto'
  return match.payload.mode === 'Manual' ? 'manual' : 'auto'
}
