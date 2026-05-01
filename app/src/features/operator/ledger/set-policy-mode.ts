import type { OperatorPolicyMode } from '@/shared/config/client'
import type { LedgerClient } from '@/shared/ledger/client'
import { OPERATOR_POLICY_TEMPLATE_ID } from '@/shared/ledger/template-ids'

export async function setOperatorPolicyMode(
  client: LedgerClient,
  args: { contractId: string; newMode: OperatorPolicyMode },
): Promise<void> {
  await client.exercise(OPERATOR_POLICY_TEMPLATE_ID, args.contractId, 'SetMode', {
    newMode: args.newMode === 'manual' ? 'Manual' : 'Auto',
  })
}
