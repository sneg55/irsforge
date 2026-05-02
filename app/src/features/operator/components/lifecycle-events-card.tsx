'use client'

import { useQuery } from '@tanstack/react-query'
import { PartyName } from 'canton-party-directory/ui'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { ROUTES } from '@/shared/constants/routes'
import { useLedger } from '@/shared/contexts/ledger-context'
import { type SwapFamily, useSwapInstruments } from '@/shared/hooks/use-swap-instruments'
import { pollIntervalWithBackoff } from '@/shared/ledger/poll-interval'
import type { SwapInstrumentPayload } from '@/shared/ledger/swap-instrument-types'
import { SWAP_WORKFLOW_TEMPLATE_ID } from '@/shared/ledger/template-ids'
import type { ContractResult, SwapWorkflow } from '@/shared/ledger/types'

// Upcoming lifecycle events for the next `LOOKAHEAD_DAYS` — one row per
// live SwapWorkflow whose instrument matures in-window. Replaces the
// operator page's prior "— (TODO: not yet wired)" stub.
//
// Scope-limited: shows maturity rows only. Coupon / fixing dates are
// derivable from the periodic schedule but require day-walking logic the
// pricer owns (@irsforge/shared-pricing); leave that for a later pass.
//
// 90 days matches DemoSeed's shortest-maturity IRS (D90 tenor). Production
// operators typically scope to 7–14 days; widen only when there's content
// to see.
const LOOKAHEAD_DAYS = 90

interface LifecycleEvent {
  swapWorkflowCid: string
  swapType: SwapFamily
  partyA: string
  partyB: string
  notional: string
  notionalCurrency: string | null
  eventKind: 'maturity'
  eventDate: string // ISO yyyy-mm-dd
  daysUntil: number
}

function notionalCurrencyFor(instr: SwapInstrumentPayload): string | null {
  // Notional is denominated in the instrument's primary currency. CCY / FX
  // carry both legs separately; the base currency anchors the notional.
  // FpML / BASIS / XCCY pull from the first stream's currency entry.
  switch (instr.swapType) {
    case 'IRS':
    case 'OIS':
    case 'CDS':
    case 'ASSET':
      return instr.payload.currency?.id?.unpack ?? null
    case 'CCY':
    case 'FX':
      return instr.payload.baseCurrency?.id?.unpack ?? null
    case 'BASIS':
    case 'XCCY':
    case 'FpML':
      return instr.payload.currencies?.[0]?.id?.unpack ?? null
    default: {
      const _exhaustive: never = instr
      return _exhaustive
    }
  }
}

function maturityDateFor(instr: SwapInstrumentPayload): string | null {
  switch (instr.swapType) {
    case 'FX':
      return instr.payload.maturityDate
    case 'IRS':
    case 'OIS':
    case 'CDS':
    case 'CCY':
    case 'ASSET':
      return instr.payload.periodicSchedule.terminationDate
    case 'BASIS':
    case 'XCCY':
    case 'FpML': {
      // FpML carries one termination per stream; any stream's terminationDate
      // is the swap's maturity (both legs share it by construction).
      const stream = instr.payload.swapStreams[0]
      return stream?.calculationPeriodDates.terminationDate.unadjustedDate ?? null
    }
    default: {
      const _exhaustive: never = instr
      return _exhaustive
    }
  }
}

function daysBetween(today: Date, target: Date): number {
  const msPerDay = 86_400_000
  return Math.round((target.getTime() - today.getTime()) / msPerDay)
}

function formatNotional(raw: string): string {
  const n = Number(raw)
  if (!Number.isFinite(n)) return raw
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`
  return n.toFixed(0)
}

export function LifecycleEventsCard() {
  const { client, activeOrg } = useLedger()
  const router = useRouter()
  const orgId = activeOrg?.id ?? ''

  const { data: workflows = [], isLoading: workflowsLoading } = useQuery<
    ContractResult<SwapWorkflow>[]
  >({
    queryKey: ['operator-lifecycle-workflows'],
    queryFn: () => {
      if (!client) throw new Error('ledger client unavailable')
      return client.query<ContractResult<SwapWorkflow>>(SWAP_WORKFLOW_TEMPLATE_ID)
    },
    enabled: !!client,
    refetchInterval: pollIntervalWithBackoff(30_000),
    staleTime: 25_000,
  })

  const families = useMemo(() => {
    const set = new Set<SwapFamily>()
    for (const w of workflows) set.add(w.payload.swapType as SwapFamily)
    return Array.from(set)
  }, [workflows])

  const { byInstrumentId, isLoading: instrumentsLoading } = useSwapInstruments(client, families)

  const events: LifecycleEvent[] = useMemo(() => {
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const horizonMs = LOOKAHEAD_DAYS * 86_400_000
    const out: LifecycleEvent[] = []
    for (const w of workflows) {
      const instr = byInstrumentId.get(w.payload.instrumentKey.id.unpack)
      if (!instr) continue
      const mat = maturityDateFor(instr)
      if (!mat) continue
      const maturityDate = new Date(mat)
      if (Number.isNaN(maturityDate.getTime())) continue
      const delta = maturityDate.getTime() - today.getTime()
      if (delta < 0 || delta > horizonMs) continue
      out.push({
        swapWorkflowCid: w.contractId,
        swapType: w.payload.swapType as SwapFamily,
        partyA: w.payload.partyA,
        partyB: w.payload.partyB,
        notional: w.payload.notional,
        notionalCurrency: notionalCurrencyFor(instr),
        eventKind: 'maturity',
        eventDate: mat,
        daysUntil: daysBetween(today, maturityDate),
      })
    }
    out.sort((a, b) => a.eventDate.localeCompare(b.eventDate))
    return out
  }, [workflows, byInstrumentId])

  const isLoading = workflowsLoading || instrumentsLoading

  return (
    <div
      data-testid="lifecycle-events-card"
      className="rounded-lg border border-zinc-800 bg-zinc-900"
    >
      <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Upcoming maturities
        </h2>
        {!isLoading && (
          <span className="text-xs text-zinc-500">
            next {LOOKAHEAD_DAYS} days · {events.length} maturit
            {events.length !== 1 ? 'ies' : 'y'}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="divide-y divide-zinc-800/50">
          {Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              data-slot="lifecycle-skeleton-row"
              className="flex items-center gap-4 px-6 py-3"
            >
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-20 ml-auto" />
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <p className="px-6 py-8 text-center text-sm text-zinc-500">
          No lifecycle events in the next {LOOKAHEAD_DAYS} days
        </p>
      ) : (
        <ul className="divide-y divide-zinc-800/50">
          {events.map((e) => {
            const swapHref = orgId ? ROUTES.ORG_WORKSPACE_SWAP(orgId, e.swapWorkflowCid) : '#'
            const ledgerHref = orgId ? ROUTES.ORG_LEDGER_CID(orgId, e.swapWorkflowCid) : '#'
            const daysLabel =
              e.daysUntil === 0
                ? 'today'
                : e.daysUntil === 1
                  ? 'in 1 day'
                  : `in ${e.daysUntil} days`
            return (
              <li
                key={e.swapWorkflowCid}
                data-testid={`lifecycle-row-${e.swapWorkflowCid.slice(0, 12)}`}
                onClick={() => orgId && router.push(swapHref)}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter' || ev.key === ' ') {
                    ev.preventDefault()
                    if (orgId) router.push(swapHref)
                  }
                }}
                tabIndex={0}
                role="link"
                aria-label={`Open ${e.swapType} ${e.eventDate} maturity`}
                className="flex cursor-pointer items-center gap-4 px-6 py-3 text-sm hover:bg-zinc-800/40 focus:bg-zinc-800/40 focus:outline-hidden"
              >
                <span className="w-24 font-mono text-xs text-zinc-400">{e.eventDate}</span>
                <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs font-medium text-zinc-300">
                  {e.swapType}
                </span>
                <span className="rounded bg-amber-900/40 px-1.5 py-0.5 text-xs text-amber-300">
                  Maturity
                </span>
                <span className="flex items-center gap-1 text-zinc-300">
                  <PartyName identifier={e.partyA} />
                  <span className="text-zinc-500">–</span>
                  <PartyName identifier={e.partyB} />
                </span>
                <span className="flex items-center gap-1.5 font-mono text-xs text-zinc-500">
                  <span>{formatNotional(e.notional)}</span>
                  {e.notionalCurrency && (
                    <span className="rounded bg-zinc-800 px-1 py-0.5 text-[10px] uppercase tracking-wide text-zinc-300">
                      {e.notionalCurrency}
                    </span>
                  )}
                </span>
                <span className="ml-auto flex items-center gap-3 text-xs">
                  <span className="text-zinc-500">{daysLabel}</span>
                  <Link
                    href={ledgerHref}
                    onClick={(ev) => ev.stopPropagation()}
                    className="text-zinc-500 hover:text-zinc-300 underline decoration-dotted"
                  >
                    Audit trail
                  </Link>
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
