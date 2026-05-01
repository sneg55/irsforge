import type { Config } from 'irsforge-shared-config'
import * as jose from 'jose'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mintDemoSchedulerToken } from '../mint-demo-scheduler-token.js'

const makeDemoConfig = (): Config =>
  ({
    auth: { provider: 'demo' },
    daml: {
      ledgerId: 'sandbox',
      applicationId: 'IRSForge',
      unsafeJwtSecret: 'secret',
    },
  }) as unknown as Config

afterEach(() => vi.restoreAllMocks())

describe('mintDemoSchedulerToken', () => {
  it('returns a token whose actAs carries the qualified Scheduler party id', async () => {
    const config = makeDemoConfig()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          result: [
            { identifier: 'Scheduler::122012ab', displayName: 'Scheduler' },
            { identifier: 'Operator::122012cd', displayName: 'Operator' },
          ],
        }),
      ),
    )
    const token = await mintDemoSchedulerToken(config)
    expect(token).not.toBeNull()
    const decoded = jose.decodeJwt(token!) as Record<string, unknown>
    const claim = decoded['https://daml.com/ledger-api'] as {
      actAs: string[]
      readAs: string[]
    }
    expect(claim.actAs).toEqual(['Scheduler::122012ab'])
    expect(claim.readAs).toEqual(
      expect.arrayContaining(['Scheduler::122012ab', 'Operator::122012cd']),
    )
  })

  it("returns null when config.auth.provider !== 'demo'", async () => {
    const config = { ...makeDemoConfig(), auth: { provider: 'oidc' } } as Config
    const token = await mintDemoSchedulerToken(config)
    expect(token).toBeNull()
  })

  it('returns null when Scheduler party not yet allocated', async () => {
    const config = makeDemoConfig()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          result: [{ identifier: 'Operator::122012cd', displayName: 'Operator' }],
        }),
      ),
    )
    const token = await mintDemoSchedulerToken(config)
    expect(token).toBeNull()
  })

  it('returns null on /v1/parties fetch failure', async () => {
    const config = makeDemoConfig()
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('econnrefused'))
    const token = await mintDemoSchedulerToken(config)
    expect(token).toBeNull()
  })
})
