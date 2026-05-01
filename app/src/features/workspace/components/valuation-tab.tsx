'use client'

import type { ValuationResult } from '@irsforge/shared-pricing'
import { formatAmount, formatFixedRate, formatNotional, valueColorClass } from '../utils/format'

interface ValuationTabProps {
  valuation: ValuationResult | null
}

export function ValuationTab({ valuation }: ValuationTabProps) {
  return (
    <div className="p-3.5">
      <div className="flex items-center gap-1 text-[9px] font-semibold tracking-wider text-[#3b82f6] mb-2">
        <div className="w-[3px] h-2.5 rounded-sm bg-[#3b82f6]" />
        NET VALUATION
      </div>
      <div className="text-center mb-2">
        <div
          className="text-[#555b6e] text-[9px]"
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
          {valuation ? formatAmount(valuation.npv) : '—'}
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
            label: 'DV01',
            tooltipKey: 'dv01',
            tooltip: 'Dollar sensitivity to a 1bp parallel shift in the discount curve.',
            value: valuation ? formatNotional(valuation.dv01) : '—',
          },
          {
            label: 'Mod Duration',
            tooltipKey: 'mod-duration',
            tooltip: 'Approximate %-change in price for a 100bp parallel rate move.',
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
              className="text-[#555b6e] text-[8px]"
              data-tooltip-key={m.tooltipKey}
              title={m.tooltip}
            >
              {m.label}
            </div>
            <div className="text-white font-mono text-[12px]">{m.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
