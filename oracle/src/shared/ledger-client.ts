import { fetchWithTimeout } from '../scheduler/retry.js'
import { ENV } from './env.js'

interface CreateCommand {
  templateId: string
  payload: Record<string, unknown>
}

interface ExerciseCommand {
  templateId: string
  contractId: string
  choice: string
  argument: Record<string, unknown>
}

export interface LedgerClientOpts {
  /** Per-request timeout in ms. Default: 5000. */
  timeoutMs?: number
}

/** Callback that returns a (possibly refreshed) Bearer token on each call. */
export type TokenProvider = () => Promise<string>

const DEFAULT_TIMEOUT_MS = 5000

export class LedgerClient {
  private readonly baseUrl: string
  private readonly getToken: TokenProvider
  private readonly timeoutMs: number

  constructor(token?: string | TokenProvider, opts: LedgerClientOpts = {}) {
    this.baseUrl = `http://${ENV.LEDGER_HOST()}:${ENV.LEDGER_PORT()}`
    if (typeof token === 'function') {
      this.getToken = token
    } else {
      const fixed = token ?? ENV.OPERATOR_TOKEN()
      this.getToken = () => Promise.resolve(fixed)
    }
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  }

  private async request(path: string, body: unknown): Promise<unknown> {
    const token = await this.getToken()
    const response = await fetchWithTimeout(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      timeoutMs: this.timeoutMs,
    })
    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Ledger API error (${response.status}): ${text}`)
    }
    return await response.json()
  }

  async create(cmd: CreateCommand): Promise<{ contractId: string }> {
    const result = await this.request('/v1/create', cmd)
    return result as { contractId: string }
  }

  async exercise(cmd: ExerciseCommand): Promise<unknown> {
    return await this.request('/v1/exercise', cmd)
  }

  async query(templateId: string, filter?: Record<string, unknown>): Promise<unknown[]> {
    const body: Record<string, unknown> = { templateIds: [templateId] }
    if (filter) body.query = filter
    const result = await this.request('/v1/query', body)
    return (result as { result: unknown[] }).result
  }
}
