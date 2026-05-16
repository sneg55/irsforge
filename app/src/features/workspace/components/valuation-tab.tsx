'use client'

import type { ValuationResult } from '@irsforge/shared-pricing'
import { formatAmount, formatFixedRate, formatNotional, valueColorClass } from '../utils/format'

interface ValuationTabProps {
  valuation: ValuationResult | null
  /** Reporting currency for NPV / DV01. Falls back to 'USD' for legacy
   *  call sites that haven't been threaded yet. Audit E4: the NET
   *  VALUATION cluster used to print raw numbers with no currency or
   *  units, so a EUR trade and a USD trade looked identical. */
  reportingCcy?: string
}

export function ValuationTab({ valuation, reportingCcy = 'USD' }: ValuationTabProps) {
  return (
    <div className="p-3.5">
      <div className="flex items-center gap-1 text-3xs font-semibold tracking-wider text-[#3b82f6] mb-2">
        <div className="w-[3px] h-2.5 rounded-sm bg-[#3b82f6]" />
        NET VALUATION
      </div>
      <div className="text-center mb-2">
        <div
          className="text-[#555b6e] text-3xs"
          data-tooltip-key="npv"
          title="Present value of all future cashflows discounted on the current curve."
        >
          Net Present Value
        </div>
        <div
          className={`text-2xl font-mono font-bold tracking-tight ${
            valuation ? valueColorClass(valuation.npv) : 'text-[#555b6e]'
          }`}
        >
          {valuation ? (
            <>
              {formatAmount(valuation.npv)}{' '}
              <span className="text-sm text-[#8b8fa3]">{reportingCcy}</span>
            </>
          ) : (
            '—'
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {[
          {
            label: 'Par Rate',
            tooltipKey: 'par-rate',
            tooltip: 'The fixed rate that makes NPV equal zero given current curves.',
            value: valuation?.parRate != null ? formatFixedRate(valuation.parRate) : '—',
          },
          {
            label: `DV01 (${reportingCcy} / bp)`,
            tooltipKey: 'dv01',
            tooltip: 'Dollar sensitivity to a 1bp parallel shift in the discount curve.',
            value: valuation ? formatNotional(valuation.dv01) : '—',
          },
          {
            label: 'Mod Duration (years)',
            tooltipKey: 'mod-duration',
            tooltip:
              'Synthetic-bond duration (years). PV01 normalised by reference notional, matching SWPM. Positive for receivers, negative for payers.',
            value: valuation?.modDuration != null ? valuation.modDuration.toFixed(2) : '—',
          },
          {
            label: 'Convexity',
            tooltipKey: 'convexity',
            tooltip: 'Second-order curvature of price with respect to rate moves.',
            value: valuation?.convexity != null ? valuation.convexity.toFixed(1) : '—',
          },
        ].map((m) => (
          <div key={m.label} className="rounded p-1.5" style={{ background: '#111320' }}>
            <div
              className="text-[#555b6e] text-3xs"
              data-tooltip-key={m.tooltipKey}
              title={m.tooltip}
            >
              {m.label}
            </div>
            <div className="text-white font-mono text-xs">{m.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
