import type { AddressInfo } from 'node:net'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WebSocketServer } from 'ws'
import type { Logger } from '../../../shared/logger.js'
import { startSwapStreamWatcher } from '../swap-stream-watcher.js'

// Real ws.Server fixture on a free port. Each test gets a fresh server so
// subprotocol assertions and event sequencing don't bleed between cases.
// Cleanup is per-test via afterEach so a failed test doesn't leak the port.

interface Fixture {
  server: WebSocketServer
  url: string
  // Connections that the server has accepted, in arrival order.
  connections: import('ws').WebSocket[]
  // Subprotocols presented by the most recent client (parsed from the upgrade headers).
  lastSubprotocols: string[]
  // Subscription payloads received from the most recent client (one per WS message).
  lastMessages: unknown[]
}

function makeLogger(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
}

async function startServer(): Promise<Fixture> {
  const fixture: Fixture = {
    server: new WebSocketServer({ port: 0 }),
    url: '',
    connections: [],
    lastSubprotocols: [],
    lastMessages: [],
  }
  await new Promise<void>((resolve) => fixture.server.once('listening', () => resolve()))
  const port = (fixture.server.address() as AddressInfo).port
  fixture.url = `ws://127.0.0.1:${port}`
  fixture.server.on('connection', (ws, req) => {
    fixture.connections.push(ws)
    fixture.lastSubprotocols = (req.headers['sec-websocket-protocol'] ?? '')
      .toString()
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    fixture.lastMessages = []
    ws.on('message', (raw) => {
      try {
        fixture.lastMessages.push(JSON.parse(raw.toString()))
      } catch {
        fixture.lastMessages.push(raw.toString())
      }
    })
  })
  return fixture
}

async function stopServer(f: Fixture): Promise<void> {
  // Force-close any lingering client sockets so .close() resolves promptly.
  for (const c of f.connections) c.terminate()
  await new Promise<void>((resolve) => f.server.close(() => resolve()))
}

// Spin until predicate is true, polling at 5ms.
async function waitFor(pred: () => boolean, label: string, timeoutMs = 1_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (pred()) return
    await new Promise((r) => setTimeout(r, 5))
  }
  throw new Error(`waitFor timed out: ${label}`)
}

describe('startSwapStreamWatcher', () => {
  let fixture: Fixture
  beforeEach(async () => {
    fixture = await startServer()
  })
  afterEach(async () => {
    await stopServer(fixture)
  })

  it('connects with the JWT + auth subprotocols and subscribes to the templateId', async () => {
    const onCreate = vi.fn()
    const handle = startSwapStreamWatcher({
      baseUrl: fixture.url,
      templateId: 'Foo:Bar',
      getToken: async () => 'TOK',
      onCreate,
      logger: makeLogger(),
    })
    await waitFor(() => fixture.connections.length === 1, 'first connection')
    await waitFor(() => fixture.lastMessages.length === 1, 'subscription message')
    expect(fixture.lastSubprotocols).toEqual(['jwt.token.TOK', 'daml.ws.auth'])
    expect(fixture.lastMessages[0]).toEqual([{ templateIds: ['Foo:Bar'] }])
    handle.stop()
  })

  it('fires onCreate when the server pushes a created event', async () => {
    const onCreate = vi.fn()
    const handle = startSwapStreamWatcher({
      baseUrl: fixture.url,
      templateId: 'Foo:Bar',
      getToken: async () => 'TOK',
      onCreate,
      logger: makeLogger(),
    })
    await waitFor(() => fixture.connections.length === 1, 'connect')
    await waitFor(() => fixture.lastMessages.length === 1, 'subscribe')
    fixture.connections[0]!.send(
      JSON.stringify({ events: [{ created: { contractId: '00abc', templateId: 'Foo:Bar' } }] }),
    )
    await waitFor(() => onCreate.mock.calls.length === 1, 'onCreate fired')
    handle.stop()
  })

  it('does not fire onCreate for archive-only events or heartbeats', async () => {
    const onCreate = vi.fn()
    const handle = startSwapStreamWatcher({
      baseUrl: fixture.url,
      templateId: 'Foo:Bar',
      getToken: async () => 'TOK',
      onCreate,
      logger: makeLogger(),
    })
    await waitFor(() => fixture.connections.length === 1, 'connect')
    await waitFor(() => fixture.lastMessages.length === 1, 'subscribe')
    fixture.connections[0]!.send(JSON.stringify({ heartbeat: 'ping' }))
    fixture.connections[0]!.send(JSON.stringify({ events: [{ archived: { contractId: '00xy' } }] }))
    fixture.connections[0]!.send(JSON.stringify({ events: [] }))
    fixture.connections[0]!.send('not-json-at-all')
    // Give the message handler a tick to process all four. None should
    // have triggered onCreate.
    await new Promise((r) => setTimeout(r, 50))
    expect(onCreate).not.toHaveBeenCalled()
    handle.stop()
  })

  it('reconnects after the server drops the connection', async () => {
    const onCreate = vi.fn()
    const handle = startSwapStreamWatcher({
      baseUrl: fixture.url,
      templateId: 'Foo:Bar',
      getToken: async () => 'TOK',
      onCreate,
      logger: makeLogger(),
    })
    await waitFor(() => fixture.connections.length === 1, 'first connect')
    fixture.connections[0]!.close()
    // First reconnect attempt fires after 1s base delay; allow up to 3s.
    await waitFor(() => fixture.connections.length === 2, 'reconnect', 3_000)
    handle.stop()
  }, 5_000)

  it('logs (and reconnects) when getToken throws', async () => {
    const logger = makeLogger()
    let attempts = 0
    const getToken = async () => {
      attempts++
      if (attempts === 1) throw new Error('mint failed')
      return 'TOK-recovered'
    }
    const handle = startSwapStreamWatcher({
      baseUrl: fixture.url,
      templateId: 'Foo:Bar',
      getToken,
      onCreate: vi.fn(),
      logger,
    })
    // First attempt rejects via getToken; reconnect schedules at 1s; second attempt succeeds.
    await waitFor(() => fixture.connections.length === 1, 'reconnect after token failure', 3_000)
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'swap_stream_token_failed' }),
    )
    handle.stop()
  }, 5_000)

  it('stop() prevents further reconnects', async () => {
    const handle = startSwapStreamWatcher({
      baseUrl: fixture.url,
      templateId: 'Foo:Bar',
      getToken: async () => 'TOK',
      onCreate: vi.fn(),
      logger: makeLogger(),
    })
    await waitFor(() => fixture.connections.length === 1, 'first connect')
    handle.stop()
    fixture.connections[0]!.close()
    // Wait past the reconnect window. A new connection here would prove the stop didn't take.
    await new Promise((r) => setTimeout(r, 1_500))
    expect(fixture.connections.length).toBe(1)
  }, 5_000)
})
