import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHttpServer } from '../server'

function urlFor(server: Server, path: string) {
  const { port } = server.address() as AddressInfo
  return `http://127.0.0.1:${port}${path}`
}

async function listen(server: Server): Promise<void> {
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()))
}

describe('createHttpServer', () => {
  let server: Server
  const origMode = process.env.ORACLE_MODE

  beforeEach(() => {
    process.env.ORACLE_MODE = 'demo'
  })
  afterEach(async () => {
    if (server) await new Promise<void>((r) => server.close(() => r()))
    if (origMode !== undefined) process.env.ORACLE_MODE = origMode
    else delete process.env.ORACLE_MODE
  })

  it('GET /api/health returns 200', async () => {
    const deps = {
      mode: 'demo' as const,
      sofrService: { fetchAndBuildCurve: vi.fn(), fetchSingleRate: vi.fn() },
      ledgerPublisher: { publishCurve: vi.fn(), publishRate: vi.fn() } as never,
    }
    server = createHttpServer(deps)
    await listen(server)
    const res = await fetch(urlFor(server, '/api/health'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
  })

  it('OPTIONS /api/health returns 204 with CORS', async () => {
    const deps = {
      mode: 'demo' as const,
      sofrService: { fetchAndBuildCurve: vi.fn(), fetchSingleRate: vi.fn() },
      ledgerPublisher: { publishCurve: vi.fn(), publishRate: vi.fn() } as never,
    }
    server = createHttpServer(deps)
    await listen(server)
    const res = await fetch(urlFor(server, '/api/health'), { method: 'OPTIONS' })
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('GET /api/unknown returns 404', async () => {
    const deps = {
      mode: 'demo' as const,
      sofrService: { fetchAndBuildCurve: vi.fn(), fetchSingleRate: vi.fn() },
      ledgerPublisher: { publishCurve: vi.fn(), publishRate: vi.fn() } as never,
    }
    server = createHttpServer(deps)
    await listen(server)
    const res = await fetch(urlFor(server, '/api/nonsense'))
    expect(res.status).toBe(404)
  })
})
