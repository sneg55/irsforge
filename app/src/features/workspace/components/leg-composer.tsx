'use client'

import { useFloatingRateIndices } from '@/shared/ledger/useFloatingRateIndex'
import { type CurrencyOption, useCurrencyOptions } from '../hooks/use-currency-options'
import type { CashflowEntry, LegConfig, WorkspaceMode } from '../types'
import { CashflowTable } from './cashflow-table'
import { FieldGrid } from './field-grid'

interface LegComposerProps {
  legs: LegConfig[]
  cashflows: CashflowEntry[][]
  legPVs: number[]
  mode: WorkspaceMode
  onUpdateLeg: (index: number, field: string, value: string) => void
  onAddLeg: () => void
  onRemoveLeg: (index: number) => void
}

const LEG_COLORS = ['#22c55e', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899']

type FieldDef = {
  label: string
  value: string | number
  editable: boolean
  onChange?: (v: string) => void
  color?: string
  type?: 'text' | 'number' | 'select'
  options?: { label: string; value: string }[]
}

function buildLegFields(
  leg: LegConfig,
  editable: boolean,
  onChange: (field: string, value: string) => void,
  currencyOptions: CurrencyOption[],
  indexOptions: { label: string; value: string }[],
): FieldDef[] {
  const fields: FieldDef[] = []

  if (leg.legType === 'fixed') {
    fields.push(
      {
        label: 'Currency',
        value: leg.currency,
        editable,
        type: 'select',
        options: currencyOptions,
        onChange: (v) => onChange('currency', v),
      },
      {
        label: 'Notional',
        value: leg.notional.toLocaleString(),
        editable,
        onChange: (v) => onChange('notional', v),
      },
      {
        label: 'Rate',
        value: `${(leg.rate * 100).toFixed(4)}%`,
        editable,
        onChange: (v) => onChange('rate', v),
      },
      {
        label: 'Day Count',
        value: leg.dayCount.replace(/_/g, '/'),
        editable,
        type: 'select',
        options: [
          { label: 'ACT/360', value: 'ACT_360' },
          { label: 'ACT/365', value: 'ACT_365' },
          { label: '30/360', value: 'THIRTY_360' },
          { label: '30E/360', value: 'THIRTY_E_360' },
        ],
        onChange: (v) => onChange('dayCount', v),
      },
      {
        label: 'Frequency',
        value: leg.schedule.frequency,
        editable,
        type: 'select',
        options: [
          { label: 'Monthly', value: 'Monthly' },
          { label: 'Quarterly', value: 'Quarterly' },
          { label: 'Semi-Annual', value: 'SemiAnnual' },
          { label: 'Annual', value: 'Annual' },
        ],
        onChange: (v) => onChange('frequency', v),
      },
    )
  } else if (leg.legType === 'float') {
    fields.push(
      {
        label: 'Currency',
        value: leg.currency,
        editable,
        type: 'select',
        options: currencyOptions,
        onChange: (v) => onChange('currency', v),
      },
      {
        label: 'Notional',
        value: leg.notional.toLocaleString(),
        editable,
        onChange: (v) => onChange('notional', v),
      },
      {
        label: 'Index',
        value: leg.indexId,
        editable,
        type: 'select',
        options:
          indexOptions.length > 0 || !leg.indexId
            ? indexOptions
            : [{ label: leg.indexId, value: leg.indexId }, ...indexOptions],
        onChange: (v) => onChange('indexId', v),
      },
      {
        label: 'Spread',
        value: `${(leg.spread * 10000).toFixed(0)} bp`,
        editable,
        onChange: (v) => onChange('spread', v),
      },
      {
        label: 'Frequency',
        value: leg.schedule.frequency,
        editable,
        type: 'select',
        options: [
          { label: 'Monthly', value: 'Monthly' },
          { label: 'Quarterly', value: 'Quarterly' },
          { label: 'Semi-Annual', value: 'SemiAnnual' },
          { label: 'Annual', value: 'Annual' },
        ],
        onChange: (v) => onChange('frequency', v),
      },
    )
  }

  return fields
}

function formatPV(n: number): string {
  const prefix = n >= 0 ? '+' : ''
  return prefix + Math.round(n).toLocaleString()
}

export function LegComposer({
  legs,
  cashflows,
  legPVs,
  mode,
  onUpdateLeg,
  onAddLeg,
  onRemoveLeg,
}: LegComposerProps) {
  const editable = mode === 'draft' || mode === 'whatif'
  const currencyOptions = useCurrencyOptions()
  const { data: allIndices } = useFloatingRateIndices()

  return (
    <div className="flex gap-3 overflow-x-auto px-3.5 py-3" style={{ minHeight: '400px' }}>
      {legs.map((leg, i) => {
        const color = LEG_COLORS[i % LEG_COLORS.length]
        const legCashflows = cashflows[i] ?? []
        const legPV = legPVs[i] ?? 0

        return (
          <div
            key={i}
            className="shrink-0 rounded-lg border border-[#1e2235] overflow-hidden"
            style={{ width: '280px', background: '#111320' }}
          >
            {/* Leg header */}
            <div
              className="flex items-center justify-between px-3 py-1.5 border-b border-[#1e2235]"
              style={{ background: `${color}15` }}
            >
              <div className="flex items-center gap-1.5">
                <div className="w-[3px] h-3.5 rounded-sm" style={{ background: color }} />
                <span className="text-3xs font-semibold tracking-wider" style={{ color }}>
                  STREAM {i + 1} — {leg.legType.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {editable && (
                  <>
                    <select
                      className="bg-transparent text-[9px] text-[#555b6e] border-none outline-hidden cursor-pointer"
                      value={leg.legType}
                      onChange={(e) => onUpdateLeg(i, 'legType', e.target.value)}
                    >
                      <option value="fixed">Fixed</option>
                      <option value="float">Float</option>
                    </select>
                    {legs.length > 1 && (
                      <button
                        onClick={() => onRemoveLeg(i)}
                        className="text-[#555b6e] hover:text-[#ef4444] text-[11px] transition-colors"
                      >
                        ×
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Fields */}
            <div className="px-3 py-2.5">
              <FieldGrid
                fields={buildLegFields(
                  leg,
                  editable,
                  (field, value) => onUpdateLeg(i, field, value),
                  currencyOptions,
                  (allIndices ?? [])
                    .filter((idx) => 'currency' in leg && idx.currency === leg.currency)
                    .map((idx) => ({ label: idx.indexId, value: idx.indexId })),
                )}
              />

              {/* Leg PV */}
              <div className="mt-2.5 pt-2 border-t border-[#1e2235]">
                <div className="text-[#555b6e] text-[8px]">PV</div>
                <div
                  className={`font-mono text-[13px] font-semibold ${legPV >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}
                >
                  {formatPV(legPV)}
                </div>
              </div>

              {/* Cashflows */}
              {legCashflows.length > 0 && (
                <div className="mt-2 pt-2 border-t border-[#1e2235]">
                  <div className="text-[#555b6e] text-[9px] tracking-wider mb-1">CASHFLOWS</div>
                  <CashflowTable
                    cashflows={legCashflows}
                    legType={
                      leg.legType === 'float'
                        ? 'float'
                        : leg.legType === 'fixed'
                          ? 'fixed'
                          : 'other'
                    }
                    direction={leg.direction}
                  />
                </div>
              )}
            </div>
          </div>
        )
      })}

      {/* Add Leg button */}
      {editable && (
        <button
          onClick={onAddLeg}
          className="shrink-0 flex items-center justify-center rounded-lg border-2 border-dashed border-[#1e2235] hover:border-[#22c55e]/50 text-[#555b6e] hover:text-[#22c55e] transition-colors"
          style={{ width: '280px', minHeight: '200px' }}
        >
          <div className="text-center">
            <div className="text-2xl mb-1">+</div>
            <div className="text-[11px]">Add Leg</div>
          </div>
        </button>
      )}
    </div>
  )
}
