import assert from 'node:assert/strict'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { Readable } from 'node:stream'
import { describe, it } from 'node:test'
import { HandoffStore } from '../auth/handoff-store.js'
import { handleHandoff } from '../routes/handoff.js'

interface Captures {
  status?: number
  body?: unknown
  headers: Record<string, string | number | string[]>
}

function makeReqWithBody(body: string): IncomingMessage {
  const stream = Readable.from([Buffer.from(body, 'utf8')])
  // Reuse IncomingMessage shape; only the data/end/error events are read by readBody.
  const req = new IncomingMessage(new Socket())
  req.method = 'POST'
  req.url = '/auth/handoff'
  // Pipe the readable into the IncomingMessage event interface.
  stream.on('data', (chunk) => req.emit('data', chunk))
  stream.on('end', () => req.emit('end'))
  stream.on('error', (err) => req.emit('error', err))
  return req
}

function makeRes(): { res: ServerResponse; captures: Captures } {
  const res = new ServerResponse(new IncomingMessage(new Socket()))
  const captures: Captures = { headers: {} }

  const origWriteHead = res.writeHead.bind(res)
  res.writeHead = ((status: number, headers?: Record<string, string>) => {
    captures.status = status
    if (headers) Object.assign(captures.headers, headers)
    return origWriteHead(status, headers as never)
  }) as typeof res.writeHead

  const origEnd = res.end.bind(res)
  res.end = ((chunk?: unknown) => {
    if (typeof chunk === 'string') {
      try {
        captures.body = JSON.parse(chunk)
      } catch {
        captures.body = chunk
      }
    }
    return origEnd(chunk as never)
  }) as typeof res.end

  return { res, captures }
}

describe('handleHandoff', () => {
  it('returns the JWT payload for a valid handoff', async () => {
    const handoffStore = new HandoffStore()
    handoffStore.put('h1', {
      accessToken: 'jwt.payload.sig',
      expiresIn: 900,
      userId: 'alice::goldman',
      orgId: 'goldman',
      party: 'PartyA::abc',
    })

    const req = makeReqWithBody(JSON.stringify({ handoff: 'h1' }))
    const { res, captures } = makeRes()
    await handleHandoff(req, res, { handoffStore })

    assert.equal(captures.status, 200)
    assert.deepEqual(captures.body, {
      accessToken: 'jwt.payload.sig',
      expiresIn: 900,
      userId: 'alice::goldman',
      orgId: 'goldman',
      party: 'PartyA::abc',
    })
  })

  it('returns 401 for an unknown handoff', async () => {
    const handoffStore = new HandoffStore()
    const req = makeReqWithBody(JSON.stringify({ handoff: 'does-not-exist' }))
    const { res, captures } = makeRes()
    await handleHandoff(req, res, { handoffStore })
    assert.equal(captures.status, 401)
  })

  it('returns 401 when the same handoff is replayed', async () => {
    const handoffStore = new HandoffStore()
    handoffStore.put('h1', {
      accessToken: 'jwt.payload.sig',
      expiresIn: 900,
      userId: 'u',
      orgId: 'goldman',
      party: 'P',
    })

    {
      const req = makeReqWithBody(JSON.stringify({ handoff: 'h1' }))
      const { res, captures } = makeRes()
      await handleHandoff(req, res, { handoffStore })
      assert.equal(captures.status, 200)
    }
    {
      const req = makeReqWithBody(JSON.stringify({ handoff: 'h1' }))
      const { res, captures } = makeRes()
      await handleHandoff(req, res, { handoffStore })
      assert.equal(captures.status, 401)
    }
  })

  it('returns 400 when handoff is missing or wrong type', async () => {
    const handoffStore = new HandoffStore()
    const req = makeReqWithBody(JSON.stringify({}))
    const { res, captures } = makeRes()
    await handleHandoff(req, res, { handoffStore })
    assert.equal(captures.status, 400)
  })

  it('returns 400 on malformed JSON', async () => {
    const handoffStore = new HandoffStore()
    const req = makeReqWithBody('{not json')
    const { res, captures } = makeRes()
    await handleHandoff(req, res, { handoffStore })
    assert.equal(captures.status, 400)
  })
})
