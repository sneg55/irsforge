import { cn } from '@/lib/utils'

// Page-level empty state shown when `useLedgerHealth()` reports `down`
// AND the calling page has no cached data to fall back on. Distinct from
// the legitimately-empty case (e.g. "no swaps yet") so users can tell
// "ledger is down" from "you simply haven't done anything yet" — the
// previous behavior collapsed both into the same "No active swaps" copy
// and made transient demo outages indistinguishable from a fresh start.
export function LedgerUnreachable({
  className,
  message,
}: {
  className?: string
  // Caller-supplied note describing what specifically the page wanted
  // to show (e.g. "your swaps", "the operator queue"). Optional —
  // defaults to a generic phrasing.
  message?: string
}) {
  return (
    <div
      data-testid="ledger-unreachable"
      role="status"
      aria-live="polite"
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-lg border border-amber-900/50 bg-amber-950/20 px-6 py-8 text-center',
        className,
      )}
    >
      <span className="flex items-center gap-2 text-sm font-medium text-amber-300">
        <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-amber-400" />
        Cannot reach the Canton ledger
      </span>
      <p className="text-xs text-amber-200/70">
        {message ?? 'The ledger is temporarily unreachable.'} Reconnecting automatically.
      </p>
    </div>
  )
}
