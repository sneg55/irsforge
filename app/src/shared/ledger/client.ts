import { ledgerActivityBus } from './activity-bus'
import { IRSFORGE_PACKAGE_ID } from './generated/package-ids'
import { ledgerHealthBus } from './health-bus'

// Daml JWT payload shape (what auth/ mints and what Canton's JSON API expects).
// `actAs` / `readAs` carry the full `Hint::fingerprint` party identifiers.
interface JwtLedgerClaims {
  readonly actAs?: readonly string[]
  readonly readAs?: readonly string[]
}
interface JwtPayload {
  readonly 'https://daml.com/ledger-api'?: JwtLedgerClaims
}

export const CLIENT_TIMEOUT_MS = 20_000

// Mutable so tests can shrink the window. Production code reads `currentTimeout`.
let currentTimeout = CLIENT_TIMEOUT_MS

export function setClientTimeoutForTesting(ms: number): void {
  currentTimeout = ms
}

export class LedgerClient {
  private partyMap: Record<string, string> | null = null

  constructor(
    private readonly token: string,
    private readonly orgId?: string,
  ) {}

  get authToken(): string {
    return this.token
  }

  private async request<T>(path: string, body: unknown): Promise<T> {
    // Route through Next.js API proxy to avoid CORS issues with Canton.
    // Every outcome — success, !ok response, network/timeout reject,
    // in-band error — is reported to ledgerHealthBus so useLedgerHealth()
    // can drive an honest StatusBar dot and per-page "ledger unreachable"
    // empty states. Without this, a half-dead Canton (sandbox JVM OOM'd,
    // JSON API process still alive) leaves the UI showing "Connected to
    // Canton" while every query silently returns no rows.
    //
    // Daml JSON API can return HTTP 200 with `{status: 500, errors: [...]}`
    // in the body when the participant gRPC backend is UNAVAILABLE
    // (verified live: `Endpoints.ParticipantServerError: UNAVAILABLE: io
    // exception` arrives wrapped in 200 OK). `response.ok` alone is not
    // enough — we also have to read the in-band `status` field and treat
    // any 4xx/5xx as a failure for both the bus and the caller.
    let response: Response
    try {
      response = await fetch('/api/ledger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
          ...(this.orgId ? { 'X-Irsforge-Org': this.orgId } : {}),
        },
        body: JSON.stringify({ path, body }),
        signal: AbortSignal.timeout(currentTimeout),
      })
    } catch (err) {
      ledgerHealthBus.recordFailure()
      throw err
    }
    if (!response.ok) {
      const text = await response.text()
      ledgerHealthBus.recordFailure()
      throw new Error(`Ledger API error (${response.status}): ${text}`)
    }
    const parsed = (await response.json()) as T
    const inBandStatus = (parsed as { status?: unknown } | null)?.status
    if (typeof inBandStatus === 'number' && inBandStatus >= 400) {
      ledgerHealthBus.recordFailure()
      const errors = (parsed as { errors?: unknown }).errors
      const detail = Array.isArray(errors) ? errors.join('; ') : ''
      throw new Error(`Ledger API error (${inBandStatus}): ${detail}`)
    }
    ledgerHealthBus.recordSuccess()
    return parsed
  }

  resolvePartyId(hint: string): Promise<string> {
    return Promise.resolve(this.resolvePartyIdSync(hint))
  }

  private resolvePartyIdSync(hint: string): string {
    if (!this.partyMap) {
      // Extract party identifiers from our own JWT token
      try {
        const segment = this.token.split('.')[1] ?? ''
        const payload = JSON.parse(atob(segment)) as JwtPayload
        const claims = payload['https://daml.com/ledger-api']
        this.partyMap = {}
        for (const p of [...(claims?.actAs ?? []), ...(claims?.readAs ?? [])]) {
          const shortName = p.split('::')[0] ?? p
          this.partyMap[shortName] = p
          this.partyMap[p] = p
        }
      } catch {
        return hint
      }
    }
    if (this.partyMap[hint]) return this.partyMap[hint]
    // Map common formats: PARTY_A → PartyA, PARTY_B → PartyB
    const hintVariants = [
      hint,
      hint.replace(/^PARTY_/, 'Party'), // PARTY_A → PartyA
      hint.replace(/_/g, ''), // PARTY_A → PARTYA
      hint.charAt(0).toUpperCase() + hint.slice(1).toLowerCase(), // party_a → Party_a
    ]
    for (const v of hintVariants) {
      if (this.partyMap[v]) return this.partyMap[v]
    }
    // Construct full identifier using our namespace
    const knownParty = Object.values(this.partyMap)[0]
    if (knownParty?.includes('::')) {
      const namespace = knownParty.split('::')[1]
      // Convert PARTY_A to PartyA for the identifier
      const cleanHint = hint.replace(/^PARTY_/, 'Party')
      return `${cleanHint}::${namespace}`
    }
    return hint
  }

  private qualifyTemplateId(templateId: string): string {
    // If already fully qualified (has two colons), return as-is
    if ((templateId.match(/:/g) || []).length >= 2) return templateId
    return `${IRSFORGE_PACKAGE_ID}:${templateId}`
  }

  async listPackages(): Promise<string[]> {
    const result = await this.request<{ result: string[] }>('/v1/packages', {})
    return result.result
  }

  async query<T>(templateId: string): Promise<T[]> {
    const qualifiedId = this.qualifyTemplateId(templateId)
    const result = await this.request<{ result: T[] }>('/v1/query', {
      templateIds: [qualifiedId],
    })
    return result.result
  }

  /**
   * Create a contract. Templates with multi-party signatories (e.g. the
   * six *Proposal templates which are signed by `proposer, operator`)
   * require the caller to list every signatory in `meta.actAs`. Passing
   * them here ensures the Canton JSON API widens the submit's authority
   * accordingly; the user's JWT must authorize each party, which in demo
   * mode is satisfied by the all-party sandbox token and in OIDC mode
   * requires the proxy/auth layer to mint a suitable token.
   */
  async create(
    templateId: string,
    payload: Record<string, unknown>,
    options?: { actAs?: string[] },
  ): Promise<{ contractId: string }> {
    const qualifiedId = this.qualifyTemplateId(templateId)
    const body: Record<string, unknown> = { templateId: qualifiedId, payload }
    if (options?.actAs && options.actAs.length > 0) body.meta = { actAs: options.actAs }
    const result = await this.request<{ result: { contractId: string } }>('/v1/create', body)
    return result.result
  }

  async exercise(
    templateId: string,
    contractId: string,
    choice: string,
    argument: Record<string, unknown>,
    options?: { actAs?: string[] },
  ): Promise<unknown> {
    const qualifiedId = this.qualifyTemplateId(templateId)
    const body: Record<string, unknown> = { templateId: qualifiedId, contractId, choice, argument }
    if (options?.actAs && options.actAs.length > 0) body.meta = { actAs: options.actAs }
    interface ExerciseResponse {
      result?: { exerciseResult?: string | { contractId?: string } }
    }
    const response = (await this.request('/v1/exercise', body)) as ExerciseResponse
    const exerciseResult = response?.result?.exerciseResult
    const resultCid =
      typeof exerciseResult === 'string'
        ? exerciseResult
        : exerciseResult && typeof exerciseResult === 'object' && 'contractId' in exerciseResult
          ? String(exerciseResult.contractId)
          : undefined
    ledgerActivityBus.emit({
      templateId,
      contractId,
      choice,
      actAs: options?.actAs ?? [],
      resultCid,
      ts: Date.now(),
    })
    return response
  }
}
