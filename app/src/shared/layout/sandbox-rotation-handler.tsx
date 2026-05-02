'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/auth-context'
import { useLedgerClient } from '../hooks/use-ledger-client'
import { useLedgerHealth } from '../hooks/use-ledger-health'
import { sandboxRotationBus } from '../ledger/sandbox-rotation-bus'

// Detection + recovery for "the participant rotated parties out from
// under us" — the demo's hourly Canton sandbox restart is the canonical
// case but anything that re-allocates parties (a topology rebuild, a
// participant migration) hits the same JWT-staleness window.
//
// Three signals feed the rotation bus, all coalesced via its 30 s
// cooldown so we remint exactly once per actual rotation:
//
//   1. Organic LedgerClient.query against FloatingRateIndex — already
//      wired in `client.ts`. Free signal whenever the user touches the
//      workspace.
//   2. Periodic canary poll (`pingCanary` on a 30 s interval) — covers
//      the page set that never queries FloatingRateIndex (e.g., a tab
//      parked on /blotter or /csa).
//   3. ledgerHealthBus down→live edge — catches the case where the
//      reset window is long enough that consecutive failures crossed
//      the threshold; we recover before the next canary tick lands.
//
// On rotation: call `auth.remintForRotation` to get a fresh JWT against
// the new boot, reset the React Query cache so all keys (which encode
// `client?.authToken`) re-issue against the new client, and surface a
// toast so the user sees a beat of "this just happened, you're fine".
// If the auto-recovery throws, the toast leaves a Reload Page CTA so
// the user can break the glass — the same F5 that has always worked.

const CANARY_POLL_MS = 30_000
const RECONNECTED_TOAST_MS = 4_000

type Phase = 'idle' | 'reconnecting' | 'reconnected' | 'error'

export function SandboxRotationHandler() {
  const { client } = useLedgerClient()
  const { remintForRotation } = useAuth()
  const queryClient = useQueryClient()
  const ledgerHealth = useLedgerHealth()
  const [phase, setPhase] = useState<Phase>('idle')

  // Forward ledgerHealth's down→{reconnecting,live} edge to the bus. We
  // use a ref so the effect doesn't re-fire on every health snapshot —
  // only on the transition that actually witnesses the recovery edge.
  const prevHealthRef = useRef(ledgerHealth)
  useEffect(() => {
    const prev = prevHealthRef.current
    const recovered =
      prev === 'down' && (ledgerHealth === 'reconnecting' || ledgerHealth === 'live')
    if (recovered) sandboxRotationBus.recordHealthReconnect()
    prevHealthRef.current = ledgerHealth
  }, [ledgerHealth])

  // Periodic canary poll. The first tick fires immediately so a tab
  // opened mid-reset detects the stale-JWT state without waiting a full
  // interval. Errors are swallowed — the canary is a signal source, not
  // a query the user is reading; a transient network blip should not
  // flip phase.
  useEffect(() => {
    if (!client) return
    let cancelled = false
    const tick = (): void => {
      void client.pingCanary().catch(() => {
        // ignored — see above
      })
    }
    tick()
    const id = setInterval(() => {
      if (!cancelled) tick()
    }, CANARY_POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [client])

  // Recovery driver. Subscribes to the rotation bus and, on event,
  // re-mints the JWT and dumps the React Query cache. The auth state
  // change rebuilds LedgerClient (token-keyed useMemo in
  // ledger-context), and resetQueries forces every active query to
  // re-issue against the new client.
  useEffect(() => {
    return sandboxRotationBus.subscribe(() => {
      setPhase('reconnecting')
      void (async () => {
        try {
          await remintForRotation()
          await queryClient.resetQueries()
          setPhase('reconnected')
          window.setTimeout(() => {
            setPhase((p) => (p === 'reconnected' ? 'idle' : p))
          }, RECONNECTED_TOAST_MS)
        } catch (err) {
          console.error('Sandbox rotation auto-recovery failed:', err)
          setPhase('error')
        }
      })()
    })
  }, [remintForRotation, queryClient])

  if (phase === 'idle') return null

  const labels: Record<Exclude<Phase, 'idle'>, string> = {
    reconnecting: 'Demo just restarted. Reconnecting…',
    reconnected: 'Reconnected. You can keep working.',
    error: 'Could not reconnect automatically.',
  }
  const label = labels[phase]
  const tone =
    phase === 'reconnected'
      ? 'border-emerald-700/60 bg-emerald-900/40 text-emerald-100'
      : phase === 'error'
        ? 'border-red-700/60 bg-red-900/40 text-red-100'
        : 'border-amber-700/60 bg-amber-900/40 text-amber-100'

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="sandbox-rotation-toast"
      className={`pointer-events-auto fixed bottom-12 right-6 z-50 flex max-w-sm items-center gap-3 rounded border px-3 py-2 text-xs shadow-lg backdrop-blur ${tone}`}
    >
      <span className="flex-1">{label}</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded border border-current/30 px-2 py-1 text-xs hover:bg-white/10"
      >
        Reload page
      </button>
    </div>
  )
}
