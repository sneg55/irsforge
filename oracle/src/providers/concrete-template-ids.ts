import {
  DEMO_STUB_PROVIDER_TEMPLATE_ID,
  NYFED_PROVIDER_TEMPLATE_ID,
} from '../shared/template-ids.js'

/**
 * Maps registered provider ids to the concrete Daml template id of the
 * implementing template. Used to query a specific provider's contract id
 * before exercising the Provider interface choice.
 *
 * To add a new provider: implement Oracle.Interface:Provider in a new
 * Daml template, regenerate package-ids, register the OracleProvider in
 * oracle/src/index.ts, and add a `<providerId>: <TEMPLATE_ID>` entry here.
 * That's the entire "register a provider" extension point on the TS side.
 */
const concreteIds: Record<string, string> = {
  nyfed: NYFED_PROVIDER_TEMPLATE_ID,
  'demo-stub': DEMO_STUB_PROVIDER_TEMPLATE_ID,
}

export function getConcreteTemplateId(providerId: string): string {
  const id = concreteIds[providerId]
  if (!id) {
    throw new Error(
      `No concrete template id registered for provider '${providerId}'; add an entry in oracle/src/providers/concrete-template-ids.ts`,
    )
  }
  return id
}
