import assert from 'node:assert/strict'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { describe, it } from 'node:test'

import { makeCorsHandler, send } from '../routes/shared.js'

function makeReq(method: string, origin?: string): IncomingMessage {
  const req = new IncomingMessage(new Socket())
  req.method = method
  if (origin) req.headers['origin'] = origin
  return req
}

interface Captures {
  headers: Record<string, string>
  status?: number
}

function makeRes(): { res: ServerResponse; captures: Captures } {
  const res = new ServerResponse(new IncomingMessage(new Socket()))
  const captures: Captures = { headers: {} }
  const origSetHeader = res.setHeader.bind(res)
  res.setHeader = (name, value) => {
    captures.headers[name] = String(value)
    return origSetHeader(name, value)
  }
  const origWriteHead = res.writeHead.bind(res)
  res.writeHead = ((status: number, headers?: Record<string, string>) => {
    captures.status = status
    if (headers) Object.assign(captures.headers, headers)
    return origWriteHead(status, headers as never)
  }) as typeof res.writeHead
  return { res, captures }
}

const ORIGINS = ['http://a.test', 'http://b.test']

describe('makeCorsHandler', () => {
  it('echoes allowed origin on OPTIONS preflight + sends 204', () => {
    const handleCors = makeCorsHandler(ORIGINS)
    const req = makeReq('OPTIONS', 'http://a.test')
    const { res, captures } = makeRes()
    const consumed = handleCors(req, res)
    assert.equal(consumed, true)
    assert.equal(captures.status, 204)
    assert.equal(captures.headers['Access-Control-Allow-Origin'], 'http://a.test')
    assert.equal(captures.headers['Vary'], 'Origin')
    assert.equal(captures.headers['Access-Control-Allow-Credentials'], 'true')
    assert.equal(captures.headers['Access-Control-Allow-Methods'], 'GET, POST, OPTIONS')
  })

  it('omits Access-Control-Allow-Origin when origin is not allowlisted', () => {
    const handleCors = makeCorsHandler(ORIGINS)
    const req = makeReq('OPTIONS', 'http://evil.test')
    const { res, captures } = makeRes()
    handleCors(req, res)
    assert.equal(captures.headers['Access-Control-Allow-Origin'], undefined)
    assert.equal(captures.headers['Vary'], undefined)
    // Other CORS headers still present (browser ignores them without Allow-Origin).
    assert.equal(captures.headers['Access-Control-Allow-Credentials'], 'true')
  })

  it('sets CORS headers on non-preflight requests and returns false', () => {
    const handleCors = makeCorsHandler(ORIGINS)
    const req = makeReq('POST', 'http://b.test')
    const { res, captures } = makeRes()
    const consumed = handleCors(req, res)
    assert.equal(consumed, false)
    assert.equal(captures.headers['Access-Control-Allow-Origin'], 'http://b.test')
    assert.equal(captures.headers['Vary'], 'Origin')
  })

  it('omits CORS origin when no Origin header (non-browser client)', () => {
    const handleCors = makeCorsHandler(ORIGINS)
    const req = makeReq('POST')
    const { res, captures } = makeRes()
    handleCors(req, res)
    assert.equal(captures.headers['Access-Control-Allow-Origin'], undefined)
  })

  it('send() preserves CORS headers previously set by handleCors', () => {
    const handleCors = makeCorsHandler(ORIGINS)
    const req = makeReq('POST', 'http://a.test')
    const { res, captures } = makeRes()
    handleCors(req, res)
    send(res, 200, { ok: true })
    assert.equal(captures.headers['Access-Control-Allow-Origin'], 'http://a.test')
    assert.equal(captures.headers['Content-Type'], 'application/json')
    assert.equal(captures.status, 200)
  })
})
