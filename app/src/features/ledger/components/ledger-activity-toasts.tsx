'use client'

import { PartyName } from 'canton-party-directory/ui'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { ROUTES } from '@/shared/constants/routes'
import { useLedgerActivityContext } from '../contexts/ledger-activity-provider'
import type { LedgerActivityEvent } from '../types'
import { kindColorClass, shortTemplate, templateIdMatchesPrefix } from '../utils'

interface Props {
  maxVisible: number
  dismissAfterMs: number
  denyPrefixes: readonly string[]
  orgId: string
}

interface ToastItem {
  event: LedgerActivityEvent
  id: string
}

// Canton's /v1/stream/query replays the full active-contract set on subscribe.
// On a fresh page load every existing SwapProposal / SwapWorkflow / AcceptAck
// lands as a CREATE — none of which are "user just did this" activity. During
// this grace window any inbound event gets marked as seen (so drawer deep-
// links still work off the buffered state) but does not fire a toast. Live
// activity after the window pops normally.
const TOAST_GRACE_MS = 1500

export function LedgerActivityToasts({ maxVisible, dismissAfterMs, denyPrefixes, orgId }: Props) {
  const { events, systemPrefixes } = useLedgerActivityContext()
  const [visible, setVisible] = useState<ToastItem[]>([])
  const seenRef = useRef(new Set<string>())
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const mountedAtRef = useRef(Date.now())

  useEffect(() => {
    if (events.length === 0) return
    const newest = events[0]
    if (!newest) return
    // Toasts are for signal, not stream dump — always hide the unconditional
    // deny list, and hide the "system" list (scheduler/oracle/mark chatter)
    // EXCEPT for exercise events. Exercise events only originate from the
    // user's own LedgerClient.exercise calls (scheduler uses a separate JWT
    // out-of-browser), so they're always user-triggered. Without this bypass,
    // a user PostCollateral on a Csa.Csa cid — where Csa.Csa is a system
    // prefix because the mark publisher rotates it — would silently no-op.
    if (denyPrefixes.some((p) => templateIdMatchesPrefix(newest.templateId, p))) return
    if (
      newest.kind !== 'exercise' &&
      systemPrefixes.some((p) => templateIdMatchesPrefix(newest.templateId, p))
    ) {
      return
    }
    const key = `${newest.ts}-${newest.contractId}-${newest.kind}`
    if (seenRef.current.has(key)) return
    seenRef.current.add(key)
    // Grace window — swallow initial-ACS replay so toasts only fire for
    // truly live activity (see TOAST_GRACE_MS comment above). The event still
    // lives in the buffer, so it shows on /ledger and deep-link drawers work.
    if (Date.now() - mountedAtRef.current < TOAST_GRACE_MS) return
    setVisible((prev) => {
      const next = [{ event: newest, id: key }, ...prev]
      if (next.length > maxVisible) next.length = maxVisible
      return next
    })
    const timer = setTimeout(() => {
      setVisible((prev) => prev.filter((t) => t.id !== key))
      timersRef.current.delete(key)
    }, dismissAfterMs)
    timersRef.current.set(key, timer)
  }, [events, denyPrefixes, systemPrefixes, maxVisible, dismissAfterMs])

  useEffect(() => {
    return () => {
      for (const timer of timersRef.current.values()) {
        clearTimeout(timer)
      }
      timersRef.current.clear()
    }
  }, [])

  if (visible.length === 0) return null

  return (
    <div className="pointer-events-none fixed bottom-12 left-6 flex w-[360px] flex-col-reverse gap-2">
      {visible.map((t) => (
        <Link
          key={t.id}
          role="status"
          href={ROUTES.ORG_LEDGER_CID(orgId, t.event.contractId)}
          className={`pointer-events-auto block overflow-hidden rounded border border-l-4 p-2 text-[11px] shadow-lg hover:translate-x-[2px] ${kindColorClass(t.event.kind, 'border-l-bg')}`}
        >
          <div className="flex min-w-0 items-center gap-2 font-mono text-[10px]">
            <span className="shrink-0 font-semibold uppercase tracking-wider">{t.event.kind}</span>
            <span className="min-w-0 flex-1 truncate text-zinc-200">
              {shortTemplate(t.event.templateId)}
            </span>
            {t.event.choice ? (
              <span className="shrink-0 text-amber-300">{t.event.choice}</span>
            ) : null}
            <span className="shrink-0 text-blue-400">{t.event.contractId.slice(0, 8)}…</span>
          </div>
          <div className="mt-0.5 text-[10px] text-zinc-500">
            {t.event.party ? (
              <>
                by <PartyName identifier={t.event.party} /> ·{' '}
              </>
            ) : null}
            just now · click to open
          </div>
        </Link>
      ))}
    </div>
  )
}
