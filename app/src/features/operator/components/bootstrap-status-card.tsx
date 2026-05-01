'use client'

import Link from 'next/link'
import { useState } from 'react'
import { LivenessDot } from '@/components/ui/liveness-dot'
import { ROUTES } from '@/shared/constants/routes'
import { useLedger } from '@/shared/contexts/ledger-context'
import type { BootstrapRow } from '../hooks/use-bootstrap-status'
import { useBootstrapStatus } from '../hooks/use-bootstrap-status'

// All operator-signed bootstrap contracts from contracts/src/Setup/
// InitImpl.daml grouped into five sections — Identity, Calendars,
// Lifecycle, Factories, Cash & oracle. Once every row is green the
// card collapses to a one-line "Platform initialized N/N" banner.

function ledgerHrefForRow(orgId: string, row: BootstrapRow): string {
  // Prefer the cid deep-link so the LedgerEventDrawer opens with the
  // specific contract's events. Fall back to a template-prefix filter
  // for rows where no cid is available (e.g. transient zero-count
  // states). Both query params land in /ledger; the page consumes them.
  const params = new URLSearchParams()
  if (row.contractId) params.set('cid', row.contractId)
  params.set('template', row.ledgerTemplateFilter)
  return `${ROUTES.ORG_LEDGER(orgId)}?${params.toString()}`
}

interface RowProps {
  row: BootstrapRow
  orgId: string
}

function Row({ row, orgId }: RowProps) {
  return (
    <li
      data-testid={`bootstrap-row-${row.key}`}
      className="flex items-center justify-between px-6 py-2 text-sm"
    >
      <span className="flex items-center gap-3">
        <span
          className={`font-mono text-xs ${
            row.loading ? 'text-zinc-600' : row.ok ? 'text-emerald-500' : 'text-red-500'
          }`}
        >
          {row.loading ? '…' : row.ok ? '✓' : '○'}
        </span>
        <span className="text-zinc-200">{row.label}</span>
      </span>
      <span className="flex items-center gap-3 text-xs">
        <span className="font-mono text-zinc-500">
          {row.loading ? '—' : `${row.count}`}
          {row.minExpected > 1 ? `/${row.minExpected}` : ''}
        </span>
        {orgId && row.count > 0 && (
          <Link
            href={ledgerHrefForRow(orgId, row)}
            className="text-zinc-500 hover:text-zinc-300 underline decoration-dotted"
          >
            view
          </Link>
        )}
      </span>
    </li>
  )
}

export function BootstrapStatusCard() {
  const { activeOrg } = useLedger()
  const orgId = activeOrg?.id ?? ''
  const [open, setOpen] = useState(false)

  const { sections, totalOk, totalRows, allOk, anyLoading } = useBootstrapStatus()

  // Once every contract is on-chain, collapse to a thin banner with one
  // pill per section so the operator can read at a glance which areas of
  // the platform are healthy without expanding. Daily-view stays clean,
  // judge-view shows full breakdown.
  if (allOk && !open) {
    return (
      <div
        data-testid="bootstrap-status-collapsed"
        className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-6 py-3"
      >
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-between text-left"
        >
          <span className="flex items-center gap-2">
            <LivenessDot state="live" title="Platform initialized" />
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
              Platform initialized
            </span>
            <span className="text-xs text-zinc-600">
              {totalOk}/{totalRows}
            </span>
          </span>
          <span className="flex items-center gap-2">
            {sections.map((section) => {
              const sectionOk = section.rows.every((r) => r.ok)
              const sectionOkCount = section.rows.filter((r) => r.ok).length
              return (
                <span
                  key={section.name}
                  data-testid={`bootstrap-pill-${section.name.toLowerCase().replace(/\s+/g, '-')}`}
                  title={`${sectionOkCount}/${section.rows.length} contracts on-chain`}
                  className={`flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wider ${
                    sectionOk
                      ? 'border-emerald-900/60 bg-emerald-950/40 text-emerald-300'
                      : 'border-amber-900/60 bg-amber-950/40 text-amber-300'
                  }`}
                >
                  <span aria-hidden="true">{sectionOk ? '✓' : '!'}</span>
                  <span>{section.name}</span>
                </span>
              )
            })}
            <span className="text-xs text-zinc-500">show</span>
          </span>
        </button>
      </div>
    )
  }

  return (
    <div
      data-testid="bootstrap-status-card"
      className="rounded-lg border border-zinc-800 bg-zinc-900"
    >
      <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
        <div className="flex items-center gap-2">
          <LivenessDot
            state={allOk ? 'live' : anyLoading ? 'idle' : 'stale'}
            title={allOk ? 'All bootstrap contracts present' : 'Bootstrap incomplete'}
          />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Platform bootstrap
          </h2>
          <span className="text-xs text-zinc-500">
            {totalOk}/{totalRows}
          </span>
        </div>
        {allOk && (
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            hide
          </button>
        )}
      </div>

      <div className="divide-y divide-zinc-800/50">
        {sections.map((section) => (
          <div key={section.name}>
            <div className="px-6 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              {section.name}
            </div>
            <ul>
              {section.rows.map((r) => (
                <Row key={r.key} row={r} orgId={orgId} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
