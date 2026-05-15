import WebSocket from 'ws'
import type { Logger } from '../../shared/logger.js'

// Push-driven trigger for the mark publisher.
//
// Subscribes to Canton's `/v1/stream/query` over WebSocket for SwapWorkflow
// CREATE events. Each create fires `onCreate()` (typically the publisher's
// coalesced tick), so an accept → mark-call lag drops from ~30s average
// (cron) to ~1s (Canton tx → stream notify → debounce → tick).
//
// Failures are non-fatal: the cron continues to drive ticks if WS is
// unreachable. Reconnects with linear backoff capped at 10s.

export interface SwapStreamWatcherOpts {
  /** Base URL of the Canton JSON API host (e.g. ws://localhost:7575). */
  baseUrl: string
  /** Template id to subscribe to — typically SWAP_WORKFLOW_TEMPLATE_ID. */
  templateId: string
  /** Async token provider — same auth used by the matching LedgerClient. */
  getToken: () => Promise<string>
  /** Fired once per CREATE event burst received from the stream. */
  onCreate: () => void
  logger: Logger
}

export interface SwapStreamWatcherHandle {
  stop: () => void
}

const RECONNECT_BASE_MS = 1_000
const RECONNECT_CAP_MS = 10_000

export function startSwapStreamWatcher(opts: SwapStreamWatcherOpts): SwapStreamWatcherHandle {
  let stopped = false
  let ws: WebSocket | null = null
  let reconnectAttempt = 0
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null

  const scheduleReconnect = () => {
    if (stopped) return
    const delay = Math.min(RECONNECT_BASE_MS * 2 ** reconnectAttempt, RECONNECT_CAP_MS)
    reconnectAttempt++
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      void connect()
    }, delay)
  }

  const connect = async () => {
    if (stopped) return
    let token: string
    try {
      token = await opts.getToken()
    } catch (err) {
      opts.logger.error({
        event: 'swap_stream_token_failed',
        error: err instanceof Error ? err.message : String(err),
      })
      scheduleReconnect()
      return
    }
    // Canton JSON API requires both subprotocols: the JWT-bearing one and
    // the auth-marker one, in this order.
    const url = `${opts.baseUrl}/v1/stream/query`
    const subprotocols = [`jwt.token.${token}`, 'daml.ws.auth']

    try {
      ws = new WebSocket(url, subprotocols)
    } catch (err) {
      opts.logger.error({
        event: 'swap_stream_construct_failed',
        error: err instanceof Error ? err.message : String(err),
      })
      scheduleReconnect()
      return
    }

    ws.on('open', () => {
      reconnectAttempt = 0
      ws?.send(JSON.stringify([{ templateIds: [opts.templateId] }]))
      opts.logger.info({ event: 'swap_stream_connected', templateId: opts.templateId })
    })

    ws.on('message', (raw) => {
      let parsed: unknown
      try {
        parsed = JSON.parse(raw.toString())
      } catch {
        return
      }
      // Canton stream events shape: `{events: [{created: {...}} | {archived: {...}}]}`.
      // Heartbeats and warnings have other shapes — we ignore them.
      if (typeof parsed !== 'object' || parsed === null) return
      const events = (parsed as { events?: unknown[] }).events
      if (!Array.isArray(events)) return
      const created = events.some(
        (e) => typeof e === 'object' && e !== null && 'created' in (e as object),
      )
      if (created) {
        opts.onCreate()
      }
    })

    ws.on('close', (code) => {
      ws = null
      opts.logger.info({ event: 'swap_stream_closed', code })
      if (!stopped) scheduleReconnect()
    })

    ws.on('error', (err) => {
      opts.logger.error({
        event: 'swap_stream_error',
        error: err instanceof Error ? err.message : String(err),
      })
      // 'close' fires after 'error', which handles reconnect.
    })
  }

  void connect()

  return {
    stop: () => {
      stopped = true
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
      ws?.close()
    },
  }
}
