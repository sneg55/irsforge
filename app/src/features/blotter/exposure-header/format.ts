import type { CsaState } from '@/shared/ledger/types'
import type { CsaStatusKind } from './types'

export const TYPE_CHIP_ORDER = ['IRS', 'OIS', 'BASIS', 'XCCY', 'CDS'] as const

export function compactCurrency(n: number): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs === 0) return '$0'
  if (abs >= 1_000_000_000) return `${sign}$${stripTrailingZero((abs / 1_000_000_000).toFixed(1))}B`
  if (abs >= 1_000_000) return `${sign}$${stripTrailingZero((abs / 1_000_000).toFixed(1))}M`
  if (abs >= 1_000) return `${sign}$${stripTrailingZero((abs / 1_000).toFixed(1))}K`
  return `${sign}$${Math.round(abs)}`
}

function stripTrailingZero(s: string): string {
  return s.endsWith('.0') ? s.slice(0, -2) : s
}

export function fullCurrency(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
}

/**
 * Ratio of the collateral held by the secured party to the active party's
 * current exposure, expressed as a percent string.
 *
 * When `exposure` is null (no published mark) or non-positive (active party
 * is in-the-money, counterparty is the obligor), the coverage ratio isn't
 * meaningful from the active party's own posting stack — return `—`
 * rather than synthesising a 0 % or 100 % placeholder.
 */
export function formatCoveragePct(ownPosted: number, exposure: number | null): string {
  if (exposure === null) return '—'
  if (exposure <= 0) return '—'
  if (ownPosted <= 0) return '0%'
  const pct = Math.round((ownPosted / exposure) * 100)
  return `${pct}%`
}

/**
 * Bar-fill fraction (0-1) for the collateral gauge. Anchored at
 * `exposure` = full bar; clamps to [0, 1]. Returns null when no mark.
 */
export function coverageFraction(ownPosted: number, exposure: number | null): number | null {
  if (exposure === null) return null
  if (exposure <= 0) return 1
  if (ownPosted <= 0) return 0
  return Math.max(0, Math.min(1, ownPosted / exposure))
}

/**
 * Maps the on-chain `CsaState` onto a status-pill kind, blending in a
 * coverage-derived hint when the state is `Active`: a call-shaped coverage
 * ratio should surface as a warning even before the ledger has fired
 * `SettleVm`, so the tile tracks intra-tick risk rather than waiting for
 * the next scheduler tick.
 */
export function deriveCsaStatus(
  state: CsaState,
  ownPosted: number,
  exposure: number | null,
): CsaStatusKind {
  if (state === 'MarginCallOutstanding') return 'call'
  if (state === 'Escalated') return 'escalated'
  if (state === 'MarkDisputed') return 'disputed'
  if (exposure === null) return 'unknown'
  if (exposure <= 0) return 'healthy'
  const coverage = ownPosted / exposure
  if (coverage >= 1) return 'healthy'
  if (coverage >= 0.8) return 'warn'
  return 'call'
}

export function csaStatusColorClass(kind: CsaStatusKind): {
  pill: string
  dot: string
  label: string
  text: string
} {
  switch (kind) {
    case 'healthy':
      return {
        pill: 'bg-green-500/10 border-green-500/30 text-green-400',
        dot: 'bg-green-500',
        label: 'Healthy',
        text: 'text-green-400',
      }
    case 'warn':
      return {
        pill: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
        dot: 'bg-amber-500',
        label: 'Warn',
        text: 'text-amber-400',
      }
    case 'call':
      return {
        pill: 'bg-red-500/10 border-red-500/30 text-red-400',
        dot: 'bg-red-500',
        label: 'Margin Call',
        text: 'text-red-400',
      }
    case 'disputed':
      return {
        pill: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
        dot: 'bg-amber-500',
        label: 'Disputed',
        text: 'text-amber-400',
      }
    case 'escalated':
      return {
        pill: 'bg-rose-700/15 border-rose-600/40 text-rose-300',
        dot: 'bg-rose-500',
        label: 'Escalated',
        text: 'text-rose-300',
      }
    case 'unknown':
      return {
        pill: 'bg-zinc-500/10 border-zinc-500/30 text-zinc-400',
        dot: 'bg-zinc-500',
        label: 'Awaiting mark',
        text: 'text-zinc-400',
      }
  }
}

export function npvColorClass(n: number): string {
  return n >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'
}

/**
 * Render the curve revaluation timestamp as `as of HH:MM:SS UTC`. Buyers
 * scanning the blotter need to know the headline tile is fresh; without
 * the stamp a stale curve is indistinguishable from a live one.
 *
 * Returns `as of —` when no curve has loaded yet so the slot keeps its
 * height across the load → live transition (avoids layout shift).
 */
export function formatAsOf(asOf: string | null | undefined): string {
  if (!asOf) return 'as of —'
  const d = new Date(asOf)
  if (Number.isNaN(d.getTime())) return 'as of —'
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  const ss = String(d.getUTCSeconds()).padStart(2, '0')
  return `as of ${hh}:${mm}:${ss} UTC`
}
