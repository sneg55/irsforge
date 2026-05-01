'use client'

import Link from 'next/link'
import { Fragment, useState } from 'react'
import { ErrorState } from '@/components/ui/error-state'
import { ROUTES } from '@/shared/constants/routes'
import { useLedger } from '@/shared/contexts/ledger-context'
import { SchedulerStatusPill } from '@/shared/scheduler/scheduler-status-pill'
import { useLastTick } from '@/shared/scheduler/use-last-tick'
import { HEALTH_CARD_TITLE, SCHEDULER_STALL_MS } from '../constants'
import { type CurveStalenessEntry, useCurveStaleness } from '../hooks/use-curve-staleness'
import { ManualFixingsPicker } from './manual-fixings-picker'

function schedulerIsStalled(lastTick: Date | null): boolean {
  if (lastTick === null) return false // "starting up" — not stalled yet
  return Date.now() - lastTick.getTime() > SCHEDULER_STALL_MS
}

function curveKey(entry: CurveStalenessEntry): string {
  return `${entry.ccy}:${entry.curveType}:${entry.indexId ?? ''}`
}

export function HealthCard() {
  const lastTick = useLastTick()
  const { entries: curves, error: curvesError, refetch: refetchCurves } = useCurveStaleness()
  const { activeOrg } = useLedger()
  const orgId = activeOrg?.id ?? ''
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const stalled = schedulerIsStalled(lastTick)
  const curvesHasError = curvesError !== null

  return (
    <>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
            {HEALTH_CARD_TITLE}
          </h2>
          <SchedulerStatusPill />
        </div>

        <div className="mb-5">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Curves
          </h3>

          {curvesHasError ? (
            <ErrorState error={curvesError} onRetry={refetchCurves} retryLabel="Retry curves" />
          ) : curves.length === 0 ? (
            <p className="text-xs text-zinc-600">No curve contracts on-chain yet.</p>
          ) : (
            <table className="w-full text-xs" data-testid="curves-table">
              <thead>
                <tr className="text-left text-zinc-500">
                  <th className="pb-1 pr-3 font-normal">Status</th>
                  <th className="pb-1 pr-4 font-normal">CCY</th>
                  <th className="pb-1 pr-4 font-normal">Type</th>
                  <th className="pb-1 pr-4 font-normal">Age</th>
                  <th className="pb-1 font-normal" />
                </tr>
              </thead>
              <tbody>
                {curves.map((entry) => {
                  const key = curveKey(entry)
                  const ageLabel =
                    entry.ageMinutes < 1 ? '<1 min ago' : `${Math.floor(entry.ageMinutes)} min ago`
                  const ageTitle = `Last published ${entry.lastPublishedAt.toISOString()}`
                  const isExpanded = expandedKey === key
                  return (
                    <Fragment key={key}>
                      <tr
                        data-testid={`curve-row-${key}`}
                        className={entry.stale ? 'bg-red-950 text-red-200' : 'text-zinc-300'}
                      >
                        <td className="py-0.5 pr-3">
                          <span
                            data-testid={`curve-status-${key}`}
                            className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide ${
                              entry.stale ? 'text-red-300' : 'text-emerald-400'
                            }`}
                          >
                            <span
                              className={`inline-block h-1.5 w-1.5 rounded-full ${
                                entry.stale ? 'bg-red-400' : 'bg-emerald-400'
                              }`}
                            />
                            {entry.stale ? 'Stale' : 'OK'}
                          </span>
                        </td>
                        <td className="py-0.5 pr-4 font-mono">{entry.ccy}</td>
                        <td className="py-0.5 pr-4">
                          {entry.curveType}
                          {entry.indexId && (
                            <span className="ml-2 font-mono text-zinc-500">{entry.indexId}</span>
                          )}
                        </td>
                        <td className="py-0.5 pr-4 font-mono" title={ageTitle}>
                          {ageLabel}
                        </td>
                        <td className="py-0.5 text-right">
                          {entry.stale && (
                            <button
                              type="button"
                              data-testid={`diagnose-${key}`}
                              className="rounded border border-zinc-700 px-2 py-0.5 text-xs text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
                              onClick={() => setExpandedKey(isExpanded ? null : key)}
                            >
                              {isExpanded ? 'Hide' : 'Why?'}
                            </button>
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr data-testid={`curve-diag-${key}`}>
                          <td colSpan={5} className="bg-red-950/40 px-3 py-2 text-xs text-red-100">
                            <dl className="space-y-1">
                              <div className="flex gap-2">
                                <dt className="w-36 text-red-300">Last published</dt>
                                <dd className="font-mono">{entry.lastPublishedAt.toISOString()}</dd>
                              </div>
                              <div className="flex gap-2">
                                <dt className="w-36 text-red-300">Age</dt>
                                <dd className="font-mono">{Math.floor(entry.ageMinutes)} min</dd>
                              </div>
                              <div className="flex gap-2">
                                <dt className="w-36 text-red-300">Index</dt>
                                <dd className="font-mono">{entry.indexId ?? '—'}</dd>
                              </div>
                              <div className="flex gap-2">
                                <dt className="w-36 text-red-300">Source</dt>
                                <dd>
                                  Oracle scheduler (see{' '}
                                  {orgId ? (
                                    <Link
                                      href={`${ROUTES.ORG_LEDGER(orgId)}?template=${encodeURIComponent(
                                        'Oracle.Curve',
                                      )}`}
                                      className="text-red-300 underline decoration-dotted hover:text-red-200"
                                    >
                                      /ledger
                                    </Link>
                                  ) : (
                                    '/ledger'
                                  )}
                                  )
                                </dd>
                              </div>
                              <div className="flex gap-2">
                                <dt className="w-36 text-red-300">Action</dt>
                                <dd className="text-red-200/80">
                                  No operator override; scheduler owns publishes. If the scheduler
                                  is stalled, use <em>Publish fixing manually</em> below for the
                                  affected swap.
                                </dd>
                              </div>
                            </dl>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Manual fallbacks
          </h3>
          <ManualFixingsPicker stalled={stalled} />
        </div>
      </div>
    </>
  )
}
