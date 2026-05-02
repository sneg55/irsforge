'use client'

interface WhatIfBannerProps {
  originalNPV: number | null
  scenarioNPV: number | null
}

export function WhatIfBanner({ originalNPV, scenarioNPV }: WhatIfBannerProps) {
  const delta = originalNPV != null && scenarioNPV != null ? scenarioNPV - originalNPV : null

  return (
    <div
      className="mx-3.5 mt-2 px-3 py-2 rounded border-2 border-dashed border-[#f59e0b]/50 text-3xs"
      style={{ background: '#f59e0b10' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[#f59e0b] font-semibold tracking-wider text-3xs">
          SCENARIO — changes do not affect on-chain contract
        </span>
        {delta != null && (
          <span className="font-mono">
            <span className="text-[#555b6e]">Δ NPV </span>
            <span className={delta >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}>
              {delta >= 0 ? '+' : ''}
              {Math.round(delta).toLocaleString()}
            </span>
          </span>
        )}
      </div>
    </div>
  )
}
