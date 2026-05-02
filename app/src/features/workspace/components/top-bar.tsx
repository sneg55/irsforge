'use client'

import { usePathname } from 'next/navigation'
import { useMemo, useState } from 'react'
import { ImportFpmlModal } from '@/features/fpml-import/import-modal'
import { useConfig } from '@/shared/contexts/config-context'
import { useIsOperator, useIsRegulator } from '@/shared/hooks/use-is-operator'
import { ALL_SWAP_TYPES, SWAP_TYPE_CONFIGS } from '../constants'
import type { SwapType, WorkspaceMode } from '../types'
import type { DateAnchor, WorkspaceDates } from '../utils/date-recalc'
import type { Tenor } from '../utils/tenor-parser'
import { EditableDate } from './editable-date'
import { EditableTenor } from './editable-tenor'

interface TopBarProps {
  swapType: SwapType
  onTypeChange: (type: SwapType) => void
  dates: WorkspaceDates
  onDateChange: (field: DateAnchor, value: Date | Tenor) => void
  mode: WorkspaceMode
  whatIfActive: boolean
  onToggleWhatIf: () => void
}

export function TopBar({
  swapType,
  onTypeChange,
  dates,
  onDateChange,
  mode,
  whatIfActive,
  onToggleWhatIf,
}: TopBarProps) {
  const isEditable = mode === 'draft'
  const isOperator = useIsOperator()
  const isRegulator = useIsRegulator()
  const { config } = useConfig()
  const pathname = usePathname()
  const [importOpen, setImportOpen] = useState(false)

  // Filter product tabs by `observables.*.enabled` so disabled products don't
  // appear at all — no tooltip-on-disabled-button. While config is loading
  // (config === null) render the full list so the viewport doesn't reflow
  // when the hook resolves; once loaded, disabled products vanish. The
  // currently-selected `swapType` stays visible even if it became disabled so
  // users viewing an existing position aren't stranded on a blank screen.
  const visibleTypes = useMemo<SwapType[]>(() => {
    if (!config?.observables) return ALL_SWAP_TYPES
    return ALL_SWAP_TYPES.filter(
      (t) => config.observables?.[t]?.enabled !== false || t === swapType,
    )
  }, [config?.observables, swapType])

  return (
    <div
      className="flex items-center justify-between px-3.5 py-2 border-b border-[#1e2235]"
      style={{ background: '#111320' }}
    >
      {/* Left: Type selector + dates */}
      <div className="flex items-center gap-3">
        {/* Type tabs */}
        <div className="flex gap-0.5">
          {visibleTypes.map((type, i) => (
            <button
              key={type}
              onClick={() => isEditable && onTypeChange(type)}
              disabled={!isEditable}
              className={`px-2.5 py-1 text-2xs font-semibold tracking-wide transition-colors ${
                type === swapType
                  ? 'bg-[#f59e0b] text-black'
                  : isEditable
                    ? 'bg-[#1e2235] text-[#555b6e] hover:text-[#8b8fa3]'
                    : 'bg-[#1e2235] text-[#555b6e]/50 cursor-not-allowed'
              } ${i === 0 ? 'rounded-l' : ''} ${i === visibleTypes.length - 1 ? 'rounded-r' : ''}`}
            >
              {SWAP_TYPE_CONFIGS[type].shortLabel}
            </button>
          ))}
        </div>

        {/* Separator */}
        <div className="w-px h-5 bg-[#1e2235]" />

        {/* Deal dates */}
        <div className="flex gap-4 text-2xs">
          <EditableDate
            label="Trade"
            value={dates.tradeDate}
            onChange={(d) => onDateChange('trade', d)}
            isEditable={isEditable}
          />
          <EditableDate
            label="Eff"
            value={dates.effectiveDate}
            onChange={(d) => onDateChange('effective', d)}
            isEditable={isEditable}
          />
          <EditableDate
            label="Mat"
            value={dates.maturityDate}
            onChange={(d) => onDateChange('maturity', d)}
            isEditable={isEditable}
          />
          <EditableTenor
            value={dates.tenor}
            onChange={(t) => onDateChange('tenor', t)}
            isEditable={isEditable}
          />
        </div>
      </div>

      {/* Right: Import FpML + What-If toggle. Scheduler-status pill lives on
          the blotter + CSA where live settlement activity matters; the
          workspace is a pre-trade pricing surface so the pill was just
          noise here. */}
      <div className="flex items-center gap-3">
        {isEditable && !isOperator && !isRegulator && (
          <button
            data-testid="import-fpml-btn"
            onClick={() => setImportOpen(true)}
            className="rounded border border-[#1e2235] bg-[#1e2235] px-2 py-1 text-2xs font-semibold text-[#8b8fa3] transition-colors hover:text-white"
          >
            Import FpML
          </button>
        )}
        {mode !== 'draft' && (
          <>
            <span className="text-[#555b6e] text-2xs uppercase tracking-wider">WHAT-IF</span>
            <button
              onClick={onToggleWhatIf}
              className={`w-8 h-4 rounded-full relative transition-colors cursor-pointer ${
                whatIfActive ? 'bg-[#f59e0b]' : 'bg-[#1e2235]'
              }`}
            >
              <div
                className={`w-3 h-3 rounded-full absolute top-0.5 transition-all ${
                  whatIfActive ? 'left-4 bg-black' : 'left-0.5 bg-[#555b6e]'
                }`}
              />
            </button>
          </>
        )}
      </div>
      {importOpen && (
        <ImportFpmlModal workspaceBase={pathname} onClose={() => setImportOpen(false)} />
      )}
    </div>
  )
}
