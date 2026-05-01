import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { writeGuard } from '../write-guard'

function makeReq() {
  const req = new IncomingMessage(new Socket())
  req.method = 'POST'
  return req
}

interface Captures {
  status?: number
  body?: string
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

describe('writeGuard', () => {
  const original = process.env.ORACLE_MODE
  beforeEach(() => {
    delete process.env.ORACLE_MODE
  })
  afterEach(() => {
    if (original !== undefined) process.env.ORACLE_MODE = original
  })

  it('returns false in demo mode (request passes through)', () => {
    process.env.ORACLE_MODE = 'demo'
    const { res, captures } = makeRes()
    const handled = writeGuard(makeReq(), res)
    expect(handled).toBe(false)
    expect(captures.status).toBeUndefined()
  })

  it('returns true with 403 in live mode', () => {
    process.env.ORACLE_MODE = 'live'
    const { res, captures } = makeRes()
    const handled = writeGuard(makeReq(), res)
    expect(handled).toBe(true)
    expect(captures.status).toBe(403)
    expect(captures.body).toContain('live')
  })
})
