'use client'
import type { PricingContext, SwapConfig } from '@irsforge/shared-pricing'
import { useState } from 'react'
import type { CurveStreamEntry } from '@/shared/ledger/useCurveStream'
import { AttributionTab } from './attribution-tab'

interface Props {
  mode: 'draft' | 'live'
  summary?: string | null
  swapConfig: SwapConfig | null
  pricingCtx: PricingContext | null
  curveHistory: CurveStreamEntry[]
  streamStatus: 'idle' | 'connecting' | 'open' | 'fallback'
}

export function AttributionDrawer({
  mode,
  summary,
  swapConfig,
  pricingCtx,
  curveHistory,
  streamStatus,
}: Props) {
  const [open, setOpen] = useState(false)
  const disabled = mode === 'draft'
  return (
    <div className="border-t border-[#1e2235]">
      <button
        data-testid="attr-header"
        aria-disabled={disabled}
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`w-full flex justify-between items-center px-3.5 py-2.5 text-[10px] font-semibold uppercase tracking-wider ${
          disabled ? 'opacity-40 cursor-default' : 'hover:bg-[#10131e] text-[#8b8fa3]'
        }`}
      >
        <span>{open ? '▾' : '▸'} P&amp;L Attribution</span>
        <span className="text-[#555b6e] font-mono tracking-normal">
          {disabled ? '—' : (summary ?? '—')}
        </span>
      </button>
      {open && !disabled && (
        <div data-testid="attr-body">
          <AttributionTab
            swapConfig={swapConfig}
            pricingCtx={pricingCtx}
            curveHistory={curveHistory}
            streamStatus={streamStatus}
          />
        </div>
      )}
    </div>
  )
}
