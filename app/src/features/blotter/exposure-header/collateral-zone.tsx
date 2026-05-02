import { PartyName } from 'canton-party-directory/ui'
import Link from 'next/link'
import { Fragment } from 'react'
import type { CsaState } from '@/shared/ledger/types'
import {
  compactCurrency,
  coverageFraction,
  csaStatusColorClass,
  deriveCsaStatus,
  formatCoveragePct,
} from './format'

interface CollateralZoneProps {
  configured: boolean
  ownPosted: number
  cptyPosted: number
  exposure: number | null
  state: CsaState
  /** Hints of regulator parties observing at least one of the active
   *  party's CSAs. Surfaced as a discreet pill so compliance can confirm
   *  oversight at a glance without leaving the trader view. */
  regulatorHints?: string[]
  csaHref?: string
}

export function CollateralZone({
  configured,
  ownPosted,
  cptyPosted,
  exposure,
  state,
  regulatorHints,
  csaHref,
}: CollateralZoneProps) {
  if (!configured) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3.5 flex flex-col">
        <div className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-2">
          Collateral (CSA)
        </div>
        <div className="flex-1 flex items-center justify-center text-2xs text-zinc-500">
          No CSA configured
        </div>
      </div>
    )
  }

  const status = deriveCsaStatus(state, ownPosted, exposure)
  const colors = csaStatusColorClass(status)
  const frac = coverageFraction(ownPosted, exposure)
  const fillPct = frac === null ? 0 : Math.round(frac * 100)
  const coverageLabel = formatCoveragePct(ownPosted, exposure)
  // Coverage-ratio is only meaningful when the active party is the obligor
  // (exposure > 0). When ITM (exposure <= 0) or no mark yet, we label the
  // headroom "—" — so we must also skip the green→red gradient, otherwise
  // a full green bar reads as "healthy" when the ratio isn't applicable.
  const coverageMeaningful = exposure !== null && exposure > 0
  // When the active party is in-the-money the counterparty's collateral is
  // what's covering the exposure, so the primary number flips sides.
  const exposureIsCpty = exposure !== null && exposure < 0
  const exposureLabel = exposure === null ? '—' : compactCurrency(Math.abs(exposure))
  const exposureCaption =
    exposure === null
      ? 'awaiting mark'
      : exposureIsCpty
        ? 'cpty owes me'
        : exposure > 0
          ? 'I owe cpty'
          : 'flat'

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3.5">
      <div className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-2">
        Collateral (CSA)
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span
            data-testid="headroom-pct"
            className={`font-mono text-[16px] font-semibold ${colors.text}`}
          >
            {coverageLabel}
          </span>
          {csaHref ? (
            <Link
              href={csaHref}
              data-testid="status-pill"
              title="Manage collateral"
              className={`inline-flex items-center gap-1.5 text-2xs font-medium px-2 py-0.5 rounded-full border transition-opacity hover:opacity-80 ${colors.pill}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
              {colors.label}
            </Link>
          ) : (
            <span
              data-testid="status-pill"
              className={`inline-flex items-center gap-1.5 text-2xs font-medium px-2 py-0.5 rounded-full border ${colors.pill}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
              {colors.label}
            </span>
          )}
        </div>
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            data-testid="bar-fill"
            className="h-full rounded-full"
            style={{
              width: coverageMeaningful ? `${fillPct}%` : '0%',
              background:
                'linear-gradient(90deg, #22c55e 0%, #22c55e 50%, #f59e0b 80%, #ef4444 100%)',
            }}
          />
        </div>
        <div className="flex items-center justify-between text-2xs font-mono">
          <span data-testid="posted-amount" className="text-zinc-300">
            {compactCurrency(ownPosted)} mine
          </span>
          <span data-testid="cpty-posted-amount" className="text-zinc-400">
            {compactCurrency(cptyPosted)} cpty
          </span>
        </div>
        <div
          data-testid="exposure-line"
          className="flex items-baseline justify-between gap-2 text-2xs font-mono"
        >
          <span className="text-zinc-500 uppercase tracking-wider text-2xs font-medium shrink-0">
            Exposure
          </span>
          <span className="text-zinc-300 whitespace-nowrap truncate">
            {exposureLabel}
            <span className="text-zinc-500 ml-1">· {exposureCaption}</span>
          </span>
        </div>
        {regulatorHints && regulatorHints.length > 0 && (
          <div
            data-testid="regulator-line"
            className="group relative inline-flex w-fit items-center gap-1.5 text-2xs font-mono text-zinc-500"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500/60" />
            <span className="truncate text-zinc-400 cursor-help underline decoration-dotted decoration-zinc-700 underline-offset-2">
              {regulatorHints.map((hint, i) => (
                <Fragment key={hint}>
                  {i > 0 && ', '}
                  <PartyName identifier={hint} />
                </Fragment>
              ))}
            </span>
            <div
              role="tooltip"
              data-testid="regulator-tooltip"
              className="pointer-events-none absolute bottom-full right-0 z-20 mb-2 w-72 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-2xs font-sans shadow-lg opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
            >
              <p className="font-semibold text-zinc-200">Regulators observing</p>
              <p className="mt-1 text-zinc-400">
                These parties have read access to every contract on this CSA pair: marks, postings,
                settlements, and lifecycle events.
              </p>
              <ul className="mt-2 space-y-0.5 text-zinc-300">
                {regulatorHints.map((hint) => (
                  <li key={hint} className="flex items-center gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-blue-500/60" />
                    <PartyName identifier={hint} />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
