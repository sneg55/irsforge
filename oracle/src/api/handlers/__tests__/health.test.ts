import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { beforeEach, describe, expect, it } from 'vitest'
import { registerProvider } from '../../../providers/registry'
import { IRSFORGE_PROVIDER_INTERFACE_ID } from '../../../shared/generated/package-ids'
import { resetState, state } from '../../../shared/state'
import { handleHealth } from '../health'

interface Captures {
  status?: number
  body?: string
}

function makeReq() {
  const req = new IncomingMessage(new Socket())
  req.method = 'GET'
  return req
}

function makeRes(): { res: ServerResponse; captures: Captures } {
  const res = new ServerResponse(new IncomingMessage(new Socket()))
  const captures: Captures = {}
  const origWrite = res.writeHead.bind(res)
  res.writeHead = ((s: number, h?: Record<string, string>) => {
    captures.status = s
    return origWrite(s, h as never)
  }) as typeof res.writeHead
  const origEnd = res.end.bind(res)
  res.end = ((body?: string) => {
    if (body) captures.body = body
    return origEnd(body as never)
  }) as typeof res.end
  return { res, captures }
}

describe('handleHealth', () => {
  beforeEach(() => resetState())

  it('returns 200 with demo-mode shape when scheduler inactive', () => {
    // Register a provider so `providers` reflects real registry state.
    // Oracle registers providers at module load, but each vitest file gets
    // a fresh registry; register explicitly to pin the expectation.
    registerProvider({
      id: 'nyfed',
      supportedRateIds: ['SOFR/INDEX'],
      onchainInterfaceTemplateId: IRSFORGE_PROVIDER_INTERFACE_ID,
      async fetchRate() {
        throw new Error('not used')
      },
    })
    const { res, captures } = makeRes()
    handleHealth(makeReq(), res, { mode: 'demo' })
    expect(captures.status).toBe(200)
    const body = JSON.parse(captures.body!)
    expect(body.status).toBe('ok')
    expect(body.mode).toBe('demo')
    expect(body.providers).toContain('nyfed')
    expect(body.lastObservation).toBeNull()
    expect(body.lastOvernightRate).toBeNull()
    expect(body.lastSuccessfulPublish).toBeNull()
    expect(body.lastPublishError).toBeNull()
    expect(body.nextScheduledRun).toBeNull()
  })

  it('reflects populated state', () => {
    state.recordObservation('SOFR/INDEX', '2026-04-13', 5.28)
    state.recordOvernightRate('2026-04-13', 5.33)
    state.lastSuccessfulPublish = {
      effectiveDate: '2026-04-13',
      publishedAt: '2026-04-13T12:30:15.000Z',
      tenors: 9,
      skipped: false,
    }
    state.nextScheduledRun = '2026-04-14T12:30:00.000Z'
    const { res, captures } = makeRes()
    handleHealth(makeReq(), res, { mode: 'live' })
    const body = JSON.parse(captures.body!)
    expect(body.mode).toBe('live')
    expect(body.lastObservation!.value).toBe(5.28)
    expect(body.lastOvernightRate!.percent).toBe(5.33)
    expect(body.lastSuccessfulPublish!.tenors).toBe(9)
    expect(body.nextScheduledRun).toBe('2026-04-14T12:30:00.000Z')
  })
})
