'use client'

import type { DiscountCurve, SwapConfig } from '@irsforge/shared-pricing'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { LivenessDot } from '@/components/ui/liveness-dot'
import { Skeleton } from '@/components/ui/skeleton'
import { formatAmount, valueColorClass } from '@/features/workspace/utils/format'
import { ROUTES } from '../constants/routes'
import { useConfig } from '../contexts/config-context'
import { useLedgerClient } from '../hooks/use-ledger-client'
import { SchedulerStatusPill } from '../scheduler/scheduler-status-pill'
import { type FooterSlotData, useFooterSlot } from './footer-slot-context'

const STALE_THRESHOLD_MS = 10 * 60 * 1000

interface OracleHealth {
  lastRate: number | null
  lastRateFetchedAt: string | null
}

interface OracleHealthResponse {
  readonly lastOvernightRate?: {
    readonly percent?: number
    readonly fetchedAt?: string
  }
}

async function fetchOracleHealth(): Promise<OracleHealth | null> {
  try {
    const res = await fetch('/api/oracle/health')
    if (!res.ok) return null
    const data = (await res.json()) as OracleHealthResponse
    const overnight = data.lastOvernightRate
    return {
      lastRate: typeof overnight?.percent === 'number' ? overnight.percent : null,
      lastRateFetchedAt: typeof overnight?.fetchedAt === 'string' ? overnight.fetchedAt : null,
    }
  } catch {
    return null
  }
}

function curveLabel(swapConfig: SwapConfig | null, curve: DiscountCurve | null): string {
  const indexIds = (swapConfig?.legs ?? [])
    .filter((l) => l.legType === 'float')
    .map((l) => (l as { indexId: string }).indexId)
  const uniq = Array.from(new Set(indexIds))
  if (uniq.length > 0) return uniq.join(' / ')
  return curve?.currency ?? '—'
}

function formatAsOf(curve: DiscountCurve | null): string {
  const d = curve?.asOf ? new Date(curve.asOf) : new Date()
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })
}

function WorkspaceSlotFragment({ slot }: { slot: FooterSlotData }) {
  const leg1PV = slot.valuation?.legPVs[0] ?? 0
  const leg2PV = slot.valuation?.legPVs[1] ?? 0
  const netPV = slot.valuation?.npv ?? 0

  return (
    <>
      <span className="h-3 w-px bg-zinc-800" />
      <span>
        <span className="text-zinc-500">Leg 1 PV </span>
        <span className={`font-mono ${valueColorClass(leg1PV)}`}>{formatAmount(leg1PV)}</span>
      </span>
      <span>
        <span className="text-zinc-500">Leg 2 PV </span>
        <span className={`font-mono ${valueColorClass(leg2PV)}`}>{formatAmount(leg2PV)}</span>
      </span>
      <span>
        <span className="text-zinc-500">Net </span>
        <span className={`font-mono font-semibold ${valueColorClass(netPV)}`}>
          {formatAmount(netPV)}
        </span>
      </span>
      <span className="ml-auto flex items-center gap-3 text-[11px] text-zinc-500">
        <span>
          Curve: <span className="text-zinc-300">{curveLabel(slot.swapConfig, slot.curve)}</span>
        </span>
        <span>
          Val: <span className="text-zinc-300">{formatAsOf(slot.curve)}</span>
        </span>
        <a
          href="https://irsforge.com"
          target="_blank"
          rel="noreferrer"
          className="text-blue-400 hover:text-blue-300 hover:underline transition-colors"
        >
          IRSForge v1
        </a>
      </span>
    </>
  )
}

export function StatusBar() {
  const { client } = useLedgerClient()
  const { config } = useConfig()
  const params = useParams()
  const orgId =
    typeof params?.orgId === 'string'
      ? params.orgId
      : Array.isArray(params?.orgId)
        ? params.orgId[0]
        : ''
  const ledgerUiEnabled = Boolean(config?.ledgerUi?.enabled)
  const healthQuery = useQuery({
    queryKey: ['oracle-health-status'],
    queryFn: fetchOracleHealth,
    staleTime: 30_000,
    refetchInterval: 30_000,
  })
  const health = healthQuery.data ?? null
  const slot = useFooterSlot()

  const lastRate = health?.lastRate ?? null
  const fetchedAt = health?.lastRateFetchedAt ?? null
  const isStale = fetchedAt
    ? Date.now() - new Date(fetchedAt).getTime() > STALE_THRESHOLD_MS
    : false

  // Resolve the active org's ledger participant URL so the "Connected to
  // Canton" surface reads as a diagnosable identity (which node?), not as
  // a generic "we're connected" placebo.
  const activeOrg = (config?.orgs ?? []).find((o) => o.id === orgId)
  const participantUrl = activeOrg?.ledgerUrl
  const connectedTitle = participantUrl
    ? `Canton participant: ${participantUrl}`
    : 'Connected to a Canton participant'

  return (
    <footer className="flex items-center gap-4 border-t border-zinc-800 bg-zinc-950 px-6 py-2 text-xs text-zinc-500">
      {client && ledgerUiEnabled && orgId ? (
        <Link
          href={ROUTES.ORG_LEDGER(orgId)}
          title={connectedTitle}
          className="flex items-center gap-1.5 rounded px-1.5 py-0.5 hover:bg-zinc-900 hover:text-zinc-200"
        >
          <LivenessDot state="live" title="Connected" placement="top" />
          <span>Connected to Canton</span>
          <span className="text-[10px] text-blue-400">↗ Audit trail</span>
        </Link>
      ) : (
        <span className="flex items-center gap-1.5" title={client ? connectedTitle : undefined}>
          <LivenessDot
            state={client ? 'live' : 'disconnected'}
            title={client ? 'Connected' : 'Disconnected'}
            placement="top"
          />
          {client ? 'Connected to Canton' : 'Disconnected'}
        </span>
      )}
      <span className="flex items-center gap-1.5 font-mono">
        <LivenessDot
          state={
            healthQuery.isError
              ? 'disconnected'
              : healthQuery.isPending
                ? 'idle'
                : isStale
                  ? 'stale'
                  : 'live'
          }
          title="Oracle feed"
          placement="top"
        />
        <span>
          SOFR:{' '}
          {healthQuery.isPending ? (
            <Skeleton className="inline-block h-3 w-12 align-middle" />
          ) : lastRate != null ? (
            <span
              className={isStale ? 'text-amber-400' : 'text-zinc-300'}
              title={
                fetchedAt
                  ? `Source: oracle Observation feed · last fetched ${fetchedAt}${isStale ? ' (stale)' : ''}`
                  : 'Source: oracle Observation feed'
              }
            >
              {lastRate.toFixed(2)}%{isStale ? ' (stale)' : ''}
            </span>
          ) : (
            '--'
          )}
        </span>
      </span>
      <SchedulerStatusPill />
      {slot ? (
        <WorkspaceSlotFragment slot={slot} />
      ) : (
        <a
          href="https://irsforge.com"
          target="_blank"
          rel="noreferrer"
          className="ml-auto text-blue-400 hover:text-blue-300 hover:underline transition-colors"
        >
          IRSForge v1
        </a>
      )}
    </footer>
  )
}
