import type { LedgerClient } from '../shared/ledger-client.js'

export interface ExerciseProviderChoiceArgs {
  /**
   * Interface template id — always `IRSFORGE_PROVIDER_INTERFACE_ID` from
   * `oracle/src/shared/generated/package-ids.ts`. Pass it explicitly here
   * so callers don't have to import the constant in every adapter.
   */
  interfaceTemplateId: string
  contractId: string
  choice: string
  argument: unknown
}

/**
 * Exercise a `Provider_*` interface choice on a concrete provider contract.
 *
 * `choice` is one of `Provider_PublishRate`,
 * `Provider_PublishDiscountCurve`, `Provider_PublishProjectionCurve`.
 *
 * The Daml-side interface lives at `Oracle.Interface:Provider`; both
 * `NYFedOracleProvider` and `DemoStubOracleProvider` implement it via
 * `interface instance Provider`. New oracle providers register the
 * same interface and reuse this helper without forking the publisher.
 */
export async function exerciseProviderChoice(
  client: Pick<LedgerClient, 'exercise'>,
  { interfaceTemplateId, contractId, choice, argument }: ExerciseProviderChoiceArgs,
): Promise<unknown> {
  return await client.exercise({
    templateId: interfaceTemplateId,
    contractId,
    choice,
    argument: argument as Record<string, unknown>,
  })
}
