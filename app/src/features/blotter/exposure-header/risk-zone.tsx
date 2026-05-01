import { compactCurrency, formatAsOf, fullCurrency, npvColorClass } from './format'

interface RiskZoneProps {
  npv: number
  dv01: number
  /** ISO timestamp from the live discount curve. Stamped under the header
   *  so a buyer can see at a glance how fresh the revaluation is. */
  asOf?: string | null
}

export function RiskZone({ npv, dv01, asOf }: RiskZoneProps) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3.5">
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Book risk
        </span>
        <span
          data-testid="risk-asof"
          className="text-[10px] font-mono text-zinc-600"
          title={asOf ?? undefined}
        >
          {formatAsOf(asOf)}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-5">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-zinc-500">NPV</div>
          <div
            data-testid="npv-value"
            className={`font-mono text-[32px] font-bold leading-none mt-1 ${npvColorClass(npv)}`}
            title={fullCurrency(npv)}
          >
            {compactCurrency(npv)}
          </div>
        </div>
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-zinc-500">DV01</div>
          <div
            data-testid="dv01-value"
            className={`font-mono text-[32px] font-bold leading-none mt-1 ${npvColorClass(dv01)}`}
            title={fullCurrency(dv01)}
          >
            {compactCurrency(dv01)}
          </div>
          <div className="text-[11px] font-mono text-zinc-500 mt-1.5">USD · parallel ·1bp</div>
        </div>
      </div>
    </div>
  )
}
