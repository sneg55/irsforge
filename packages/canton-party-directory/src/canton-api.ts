import { extractHint } from './fallback'
import type { PartyEntry } from './types'

interface FetchConfig {
  ledgerUrl?: string
  proxyUrl?: string
  token?: string | (() => string | Promise<string>)
}

interface CantonParty {
  identifier: string
  displayName?: string
  isLocal?: boolean
}

async function resolveToken(token: FetchConfig['token']): Promise<string> {
  if (!token) return ''
  if (typeof token === 'function') return await token()
  return token
}

export async function fetchParties(config: FetchConfig): Promise<PartyEntry[]> {
  try {
    const resolved = await resolveToken(config.token)

    let response: Response
    if (config.proxyUrl) {
      response = await fetch(config.proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resolved}`,
        },
        body: JSON.stringify({ path: '/v1/parties', body: {} }),
      })
    } else if (config.ledgerUrl) {
      response = await fetch(`${config.ledgerUrl}/v1/parties`, {
        headers: { Authorization: `Bearer ${resolved}` },
      })
    } else {
      return []
    }

    if (!response.ok) return []

    const data = (await response.json()) as { result?: CantonParty[] }
    const parties: CantonParty[] = data.result ?? []

    return parties.map((p) => ({
      identifier: p.identifier,
      displayName: p.displayName ?? extractHint(p.identifier),
      hint: extractHint(p.identifier),
    }))
  } catch {
    return []
  }
}
