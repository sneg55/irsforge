import { ENV } from '../shared/env.js'

interface PartyDetails {
  identifier: string
  displayName?: string
}

export interface QualifiedParties {
  operator: string
  partyA: string
  partyB: string
  // Demo profile resolves a single canonical regulator hint to a one-element
  // list. Multi-regulator deployments will populate this from config.
  regulators: string[]
  scheduler?: string
}

// Look up a party's qualified id (`Hint::1220…`) by short-name or displayName.
// Used by the FxSpot seeder to construct payloads whose signatory/observer
// fields match the qualified ids in the oracle's actAs JWT — Canton rejects
// unqualified hints with DAML_AUTHORIZATION_ERROR even when the token hint
// shares the short-name.
export async function resolveQualifiedParties(token: string): Promise<QualifiedParties | null> {
  const baseUrl = `http://${ENV.LEDGER_HOST()}:${ENV.LEDGER_PORT()}`
  let parties: PartyDetails[]
  try {
    const res = await fetch(`${baseUrl}/v1/parties`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    const json = (await res.json()) as { result?: PartyDetails[] }
    parties = json.result ?? []
  } catch {
    return null
  }

  const findByHint = (hint: string): string | undefined =>
    parties.find((p) => p.identifier.split('::')[0] === hint || p.displayName === hint)?.identifier

  const operator = findByHint('Operator')
  const partyA = findByHint('PartyA')
  const partyB = findByHint('PartyB')
  const regulator = findByHint('Regulator')
  if (!operator || !partyA || !partyB || !regulator) return null

  return {
    operator,
    partyA,
    partyB,
    regulators: [regulator],
    scheduler: findByHint('Scheduler'),
  }
}
