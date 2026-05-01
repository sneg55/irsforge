import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { handleFetchSofr, handlePublishCurve, handlePublishRate } from '../admin'

interface Captures {
  status?: number
  body?: string
}
function makeReq(body?: string) {
  const r = new IncomingMessage(new Socket())
  r.method = 'POST'
  process.nextTick(() => {
    if (body) r.emit('data', Buffer.from(body))
    r.emit('end')
  })
  return r
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

const origMode = process.env.ORACLE_MODE
afterEach(() => {
  if (origMode !== undefined) process.env.ORACLE_MODE = origMode
  else delete process.env.ORACLE_MODE
})

describe('handlePublishCurve (demo mode)', () => {
  beforeEach(() => {
    process.env.ORACLE_MODE = 'demo'
  })

  it('publishes via ledgerPublisher and returns count', async () => {
    const sofrService = {
      fetchAndBuildCurve: vi
        .fn()
        .mockResolvedValue([{ rateId: 'SOFR/ON', tenorDays: 1, rate: 0.05 }]),
      fetchSingleRate: vi.fn(),
    }
    const ledgerPublisher = {
      publishCurve: vi.fn().mockResolvedValue({ skipped: false, count: 1 }),
      publishRate: vi.fn(),
    }
    const { res, captures } = makeRes()
    await handlePublishCurve(makeReq(JSON.stringify({ date: '2026-04-13' })), res, {
      sofrService,
      ledgerPublisher: ledgerPublisher as never,
    })
    expect(captures.status).toBe(200)
    const body = JSON.parse(captures.body!)
    expect(body.published).toBe(1)
    expect(body.skipped).toBe(false)
  })
})

describe('write-guard (live mode)', () => {
  beforeEach(() => {
    process.env.ORACLE_MODE = 'live'
  })

  it('publish-curve returns 403 in live mode', async () => {
    const sofrService = { fetchAndBuildCurve: vi.fn(), fetchSingleRate: vi.fn() }
    const ledgerPublisher = { publishCurve: vi.fn(), publishRate: vi.fn() }
    const { res, captures } = makeRes()
    await handlePublishCurve(makeReq('{}'), res, {
      sofrService,
      ledgerPublisher: ledgerPublisher as never,
    })
    expect(captures.status).toBe(403)
    expect(ledgerPublisher.publishCurve).not.toHaveBeenCalled()
  })

  it('publish-rate returns 403 in live mode', async () => {
    const sofrService = { fetchAndBuildCurve: vi.fn(), fetchSingleRate: vi.fn() }
    const ledgerPublisher = { publishCurve: vi.fn(), publishRate: vi.fn() }
    const { res, captures } = makeRes()
    await handlePublishRate(makeReq('{}'), res, {
      sofrService,
      ledgerPublisher: ledgerPublisher as never,
    })
    expect(captures.status).toBe(403)
  })

  it('fetch-sofr returns 403 in live mode', async () => {
    const sofrService = { fetchAndBuildCurve: vi.fn(), fetchSingleRate: vi.fn() }
    const ledgerPublisher = { publishCurve: vi.fn(), publishRate: vi.fn() }
    const { res, captures } = makeRes()
    await handleFetchSofr(makeReq('{}'), res, {
      sofrService,
      ledgerPublisher: ledgerPublisher as never,
    })
    expect(captures.status).toBe(403)
  })
})
