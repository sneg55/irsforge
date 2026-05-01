import { SignJWT } from 'jose'

export interface TokenParams {
  userId: string
  orgId: string
  actAs: string[]
  readAs: string[]
  issuer: string
  ttlSeconds: number
  ledgerId: string
  applicationId: string
}

const LEDGER_API_CLAIM = 'https://daml.com/ledger-api'

export async function createDamlToken(privateKey: CryptoKey, params: TokenParams): Promise<string> {
  const { userId, orgId, actAs, readAs, issuer, ttlSeconds, ledgerId, applicationId } = params

  const now = Math.floor(Date.now() / 1000)

  return await new SignJWT({
    [LEDGER_API_CLAIM]: {
      ledgerId,
      applicationId,
      actAs,
      readAs,
    },
    org: orgId,
  })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(issuer)
    .setSubject(userId)
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSeconds)
    .sign(privateKey)
}
