import { compactCurrency, formatAsOf, fullCurrency, TYPE_CHIP_ORDER } from './format'

interface VolumeZoneProps {
  notional: number
  activeSwaps: number
  swapCountByType: Record<string, number>
  /** ISO timestamp from the live discount curve, stamped under the header
   *  to match the BOOK RISK tile. */
  asOf?: string | null
}

function orderedTypes(swapCountByType: Record<string, number>): [string, number][] {
  const known = TYPE_CHIP_ORDER.filter((t) => (swapCountByType[t] ?? 0) > 0).map(
    (t) => [t, swapCountByType[t]] as [string, number],
  )
  const unknown = Object.entries(swapCountByType)
    .filter(([t, n]) => n > 0 && !TYPE_CHIP_ORDER.includes(t as (typeof TYPE_CHIP_ORDER)[number]))
    .map(([t, n]) => [t, n] as [string, number])
  return [...known, ...unknown]
}

export function VolumeZone({ notional, activeSwaps, swapCountByType, asOf }: VolumeZoneProps) {
  const types = orderedTypes(swapCountByType)
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3.5">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Book size
        </span>
        <span
          data-testid="volume-asof"
          className="text-[10px] font-mono text-zinc-600"
          title={asOf ?? undefined}
        >
          {formatAsOf(asOf)}
        </span>
      </div>
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2">
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Notional
          </span>
          <span
            data-testid="notional-value"
            className="font-mono text-[13px] font-semibold text-zinc-200"
            title={fullCurrency(notional)}
          >
            {compactCurrency(notional)}
          </span>
        </div>
        <div className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2">
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Trades</span>
          <span
            data-testid="trades-value"
            className="font-mono text-[13px] font-semibold text-zinc-200"
          >
            {activeSwaps}
          </span>
        </div>
        {types.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {types.map(([type, count]) => (
              <span
                key={type}
                data-testid="type-chip"
                className="bg-zinc-800 text-zinc-400 text-[11px] px-1.5 py-0.5 rounded font-mono"
              >
                {type} · {count}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
