'use client'

import { useEffect, useRef, useState } from 'react'
import { resolveStreamUrl } from '../config/client'
import { useLedger } from '../contexts/ledger-context'

export interface StreamOptions<T> {
  templateId: string
  onCreated: (payload: T, contractId: string) => void
  onClose?: (event: CloseEvent) => void
  onError?: (error: Error) => void
  enabled: boolean
}

type Status = 'idle' | 'connecting' | 'open' | 'closed' | 'fallback'

// Retry policy: time-budgeted, not attempt-counted.
//
// The previous count-based ceiling (MAX_RETRIES=5, BASE_BACKOFF_MS=100)
// burned through retries in ~3s — far short of the ~30-60s demo-restart
// window, so any tab open during an hourly reset went to 'fallback' and
// stayed there until the user pressed F5 (the polling fallback survives
// but the WS push path is gone).
//
// Budget covers ~90s of disconnection (longer than the worst observed
// reset cycle) and resets on every successful onopen, so subsequent
// disconnects get a fresh window.
const RETRY_BUDGET_MS = 90_000
const BASE_BACKOFF_MS = 100
const MAX_BACKOFF_MS = 10_000

function backoffDelay(attempt: number): number {
  const base = BASE_BACKOFF_MS * 2 ** (attempt - 1)
  const jitter = 1 + (Math.random() - 0.5) * 0.5
  return Math.min(MAX_BACKOFF_MS, Math.max(50, Math.round(base * jitter)))
}

export function useStreamedContracts<T>(opts: StreamOptions<T>): {
  status: Status
  lastError: Error | null
} {
  const { client, activeOrg } = useLedger()
  const [status, setStatus] = useState<Status>('idle')
  const [lastError, setLastError] = useState<Error | null>(null)
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryCount = useRef(0)
  // First-failure timestamp in the current disconnection cycle. Cleared
  // on every successful onopen so a long-lived tab gets a fresh budget
  // for each independent outage rather than a single global one.
  const retryStartedAt = useRef<number | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  // Stable primitives derived from objects to avoid spurious re-mounts when
  // the context returns a new object reference on every render.
  const authToken = client?.authToken ?? null
  const streamBase = activeOrg ? (activeOrg.streamUrl ?? activeOrg.ledgerUrl) : null
  const orgId = activeOrg?.id ?? null

  useEffect(() => {
    if (!opts.enabled || !client || !activeOrg) {
      setStatus('idle')
      return
    }

    let cancelled = false

    const open = () => {
      if (cancelled) return
      let url: string
      try {
        url = `${resolveStreamUrl(activeOrg)}/v1/stream/query`
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err))
        setLastError(e)
        opts.onError?.(e)
        setStatus('fallback')
        return
      }
      setStatus('connecting')

      const ws = new WebSocket(url, [`jwt.token.${client.authToken}`, 'daml.ws.auth'])
      wsRef.current = ws

      ws.onopen = () => {
        if (cancelled) return
        setStatus('open')
        retryCount.current = 0
        retryStartedAt.current = null
        ws.send(JSON.stringify([{ templateIds: [opts.templateId] }]))
      }

      ws.onmessage = (ev) => {
        if (cancelled) return
        let msg: unknown
        try {
          msg = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data))
        } catch {
          return
        }
        if (!msg || typeof msg !== 'object') return
        const events = (msg as { events?: Array<{ created?: { contractId: string; payload: T } }> })
          .events
        if (!Array.isArray(events)) return
        for (const e of events) {
          if (e.created) opts.onCreated(e.created.payload, e.created.contractId)
        }
      }

      ws.onerror = () => {
        if (cancelled) return
        const e = new Error(`WebSocket error on ${url}`)
        setLastError(e)
        opts.onError?.(e)
      }

      ws.onclose = (ev) => {
        if (cancelled) return
        if (ev.wasClean) {
          setStatus('closed')
          return
        }
        if (retryStartedAt.current === null) {
          retryStartedAt.current = Date.now()
        }
        const elapsed = Date.now() - retryStartedAt.current
        if (elapsed >= RETRY_BUDGET_MS) {
          setStatus('fallback')
          opts.onClose?.(ev)
          return
        }
        retryCount.current += 1
        retryTimer.current = setTimeout(open, backoffDelay(retryCount.current))
      }
    }

    open()

    return () => {
      cancelled = true
      if (retryTimer.current) clearTimeout(retryTimer.current)
      wsRef.current?.close()
    }
  }, [opts.enabled, opts.templateId, authToken, streamBase, orgId])

  return { status, lastError }
}
