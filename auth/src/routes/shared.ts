import type { IncomingMessage, ServerResponse } from 'node:http'

const CORS_METHODS = 'GET, POST, OPTIONS'
const CORS_HEADERS = 'Content-Type, Authorization'

const MAX_BODY_SIZE = 65536 // 64KB

export type CorsHandler = (req: IncomingMessage, res: ServerResponse) => boolean

export function makeCorsHandler(allowedOrigins: readonly string[]): CorsHandler {
  const allowSet = new Set(allowedOrigins)

  function resolveCorsHeaders(req: IncomingMessage): Record<string, string> {
    const origin = req.headers['origin']
    const headers: Record<string, string> = {
      'Access-Control-Allow-Methods': CORS_METHODS,
      'Access-Control-Allow-Headers': CORS_HEADERS,
      'Access-Control-Allow-Credentials': 'true',
    }
    if (typeof origin === 'string' && allowSet.has(origin)) {
      headers['Access-Control-Allow-Origin'] = origin
      headers['Vary'] = 'Origin'
    }
    return headers
  }

  return function handleCors(req: IncomingMessage, res: ServerResponse): boolean {
    const headers = resolveCorsHeaders(req)
    if (req.method === 'OPTIONS') {
      res.writeHead(204, headers)
      res.end()
      return true
    }
    for (const [key, value] of Object.entries(headers)) {
      res.setHeader(key, value)
    }
    return false
  }
}

export function send(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body)
  // CORS headers (if any) were already set via setHeader inside the cors
  // handler; writeHead here only adds Content-Type without clobbering them.
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(json)
}

export function sendError(res: ServerResponse, status: number, message: string): void {
  send(res, status, { error: message })
}

export function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let totalSize = 0
    req.on('data', (chunk: Buffer) => {
      totalSize += chunk.length
      if (totalSize > MAX_BODY_SIZE) {
        reject(new Error('Body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

export function parseCookies(req: IncomingMessage): Record<string, string> {
  const cookieHeader = req.headers['cookie'] ?? ''
  const result: Record<string, string> = {}

  for (const part of cookieHeader.split(';')) {
    const eqIdx = part.indexOf('=')
    if (eqIdx === -1) continue
    const name = part.slice(0, eqIdx).trim()
    const value = part.slice(eqIdx + 1).trim()
    if (name) {
      result[name] = decodeURIComponent(value)
    }
  }

  return result
}
