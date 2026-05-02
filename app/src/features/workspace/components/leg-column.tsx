'use client'

import type { PricingContext } from '@irsforge/shared-pricing'
import { useFloatingRateIndices } from '@/shared/ledger/useFloatingRateIndex'
import { useCurrencyOptions } from '../hooks/use-currency-options'
import type { CashflowEntry, LegConfig, WorkspaceMode } from '../types'

import { formatAmount, formatFloatRate, valueColorClass } from '../utils/format'
import { CashflowTable } from './cashflow-table'
import { FieldGrid } from './field-grid'
import { buildFields } from './leg-column.fields'
import { computeAccrued, getAccentColor, getLegLabel } from './leg-column.helpers'
import { UnderlyingsEditor } from './underlyings-editor'

interface LegColumnProps {
  leg: LegConfig
  legIndex: number
  cashflows: CashflowEntry[]
  legPV: number
  mode: WorkspaceMode
  onUpdateLeg: (field: string, value: unknown) => void
  onNotionalChange: (value: number) => void
  onToggleDirection: () => void
  /** Pricing context — used to extract reportingCcy and fxSpots for FX translation on foreign legs. */
  pricingCtx?: PricingContext | null
  /** Whether notionals are linked across legs. Only rendered on leg index 0. */
  notionalLinked?: boolean
  onToggleNotionalLink?: () => void
}

export function LegColumn({
  leg,
  legIndex,
  cashflows,
  legPV,
  mode,
  onUpdateLeg,
  onNotionalChange,
  onToggleDirection,
  pricingCtx,
  notionalLinked,
  onToggleNotionalLink,
}: LegColumnProps) {
  const accent = getAccentColor(legIndex)
  const editable = mode === 'draft' || mode === 'whatif'
  const legLabel = getLegLabel(leg, legIndex)
  const currencyOptions = useCurrencyOptions()
  const { data: allIndices } = useFloatingRateIndices()
  const legCurrency = 'currency' in leg ? leg.currency : undefined
  const indexOptions = (allIndices ?? [])
    .filter((idx) => legCurrency !== undefined && idx.currency === legCurrency)
    .map((idx) => ({ label: idx.indexId, value: idx.indexId }))

  // Intercept notional edits to use SET_LEG_NOTIONAL (which respects the link).
  const handleFieldChange = (field: string, value: string) => {
    if (field === 'notional' && editable) {
      const n = Number(value)
      if (Number.isFinite(n)) {
        onNotionalChange(n)
        return
      }
    }
    onUpdateLeg(field, value)
  }

  // Link/unlink button rendered inline next to the "Notional" label.
  // Only shown on leg 0 to avoid redundant double-button.
  const linkButton =
    legIndex === 0 && editable && onToggleNotionalLink ? (
      <button
        type="button"
        title={
          notionalLinked
            ? 'Notionals linked — click to unlink'
            : 'Notionals unlinked — click to link'
        }
        className="text-3xs leading-none opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
        onClick={(e) => {
          e.stopPropagation()
          onToggleNotionalLink()
        }}
      >
        {notionalLinked ? '🔗' : '🔓'}
      </button>
    ) : undefined

  const fields = buildFields(
    leg,
    editable,
    handleFieldChange,
    currencyOptions,
    indexOptions,
    linkButton,
  )
  const legTypeForCashflows =
    leg.legType === 'float' ? 'float' : leg.legType === 'fixed' ? 'fixed' : 'other'
  // FX translation: derive leg currency from the config so the cashflow table
  // can show reporting-ccy amounts for foreign legs (XCCY leg2 = EUR, etc.).
  const reportingCcy = pricingCtx?.reportingCcy
  const fxSpots = pricingCtx?.fxSpots

  return (
    <div className="border-r border-[#1e2235] last:border-r-0 flex flex-col h-full">
      {/* 1. Header */}
      <div
        className="flex items-center justify-between px-3.5 py-1.5 border-b border-[#1e2235] shrink-0"
        style={{ background: `${accent}15` }}
      >
        <div className="flex items-center gap-1.5">
          <div className="w-[3px] h-3.5 rounded-sm" style={{ background: accent }} />
          <span className="text-2xs font-semibold tracking-wider" style={{ color: accent }}>
            {legLabel}
          </span>
        </div>
        <button
          className="text-[#555b6e] text-2xs hover:text-[#8b8fa3] transition-colors"
          onClick={onToggleDirection}
        >
          ⇄ Flip pay/receive
        </button>
      </div>

      {/* 2. Terms Grid — fixed height so valuation/cashflows align across legs */}
      <div
        className={`px-3.5 pt-3 shrink-0 ${mode === 'active' ? 'opacity-70 pointer-events-none' : ''}`}
        data-testid="leg-field-grid"
        data-readonly={mode === 'active' ? 'true' : 'false'}
        style={{ minHeight: '220px' }}
        title={
          mode === 'active'
            ? 'Live trade — terms locked. Toggle WHAT-IF to model changes.'
            : undefined
        }
      >
        <FieldGrid fields={fields} />
        {leg.legType === 'asset' && (
          <UnderlyingsEditor
            underlyings={leg.underlyings}
            editable={editable}
            onChange={(u) => onUpdateLeg('underlyings', u)}
          />
        )}
      </div>

      {/* 3. Valuation + Cashflows — aligned across legs */}
      <div className="px-3.5 pb-3 flex-1 overflow-y-auto">
        {/* 3a. Leg Valuation */}
        <div className="pt-2.5 border-t border-[#1e2235]">
          <div className="text-[#555b6e] text-2xs font-semibold tracking-wider mb-1.5">
            LEG VALUATION
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="rounded p-1.5" style={{ background: '#111320' }}>
              <div className="text-[#555b6e] text-3xs uppercase tracking-wide">PV</div>
              <div className={`font-mono text-sm font-semibold ${valueColorClass(legPV)}`}>
                {formatAmount(legPV)}
              </div>
            </div>
            <div className="rounded p-1.5" style={{ background: '#111320' }}>
              <div className="text-[#555b6e] text-3xs uppercase tracking-wide">
                {leg.legType === 'float' ? 'Next Fixing' : 'Accrued'}
              </div>
              <div className="font-mono text-sm text-white">
                {leg.legType === 'float'
                  ? (() => {
                      // Skip initial-exchange rows (no projectedRate) to find the first real fixing.
                      const nextFix = cashflows.find((cf) => cf.projectedRate != null)
                      return nextFix ? formatFloatRate(nextFix.projectedRate!) : '—'
                    })()
                  : leg.legType === 'fixed'
                    ? formatAmount(computeAccrued(cashflows, leg))
                    : '—'}
              </div>
            </div>
          </div>
        </div>

        {/* 3b. Cashflows */}
        <div className="mt-3 pt-2.5 border-t border-[#1e2235]">
          <div className="text-[#555b6e] text-2xs font-semibold tracking-wider mb-1">
            {leg.legType === 'float'
              ? 'FLOAT CASHFLOWS'
              : leg.legType === 'fixed'
                ? 'FIXED CASHFLOWS'
                : 'CASHFLOWS'}
          </div>
          <CashflowTable
            cashflows={cashflows}
            legType={legTypeForCashflows}
            direction={leg.direction}
            legCurrency={legCurrency}
            reportingCcy={reportingCcy}
            fxSpots={fxSpots}
          />
        </div>
      </div>
    </div>
  )
}
