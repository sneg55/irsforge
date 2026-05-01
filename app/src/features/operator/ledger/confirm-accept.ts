import type { LedgerClient } from '@/shared/ledger/client'
import { OPERATOR_ACCEPT_ACK, type SwapFamily } from '@/shared/ledger/operator-registry'

export async function confirmAccept(
  client: LedgerClient,
  args: { family: SwapFamily; ackContractId: string },
): Promise<void> {
  const entry = OPERATOR_ACCEPT_ACK[args.family]
  await client.exercise(entry.templateId, args.ackContractId, entry.confirmChoice, {})
}
