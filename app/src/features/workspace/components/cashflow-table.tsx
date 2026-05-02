'use client'

import { useState } from 'react'
import type { CashflowEntry } from '../types'
import { formatAmount, formatDF, formatFloatRate, valueColorClass } from '../utils/format'

interface CashflowTableProps {
  cashflows: CashflowEntry[]
  legType: 'fixed' | 'float' | 'other'
  direction: 'pay' | 'receive'
  /** ISO currency code for this leg's cashflows (e.g. 'EUR'). */
  legCurrency?: string
  /** Reporting currency the workspace uses for NPV (e.g. 'USD'). */
  reportingCcy?: string
  /** Spot FX rates keyed `${baseCcy}${quoteCcy}` (e.g. EURUSD: 1.08). */
  fxSpots?: Record<string, number>
}

const INITIAL_ROWS = 6

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })
}

/**
 * Resolve the FX factor to convert from `fromCcy` to `toCcy`.
 * Returns 1 when currencies match or spots are missing (silent fallback).
 */
function resolveFx(fromCcy: string, toCcy: string, spots: Record<string, number>): number {
  if (fromCcy === toCcy) return 1
  const direct = spots[`${fromCcy}${toCcy}`]
  if (direct) return direct
  const inverse = spots[`${toCcy}${fromCcy}`]
  if (inverse) return 1 / inverse
  return 1 // no rate available — show native amount
}

export function CashflowTable({
  cashflows,
  legType,
  direction,
  legCurrency,
  reportingCcy,
  fxSpots,
}: CashflowTableProps) {
  const [expanded, setExpanded] = useState(false)
  const displayCashflows = expanded ? cashflows : cashflows.slice(0, INITIAL_ROWS)
  const remaining = cashflows.length - INITIAL_ROWS
  const sign = direction === 'pay' ? -1 : 1

  const needsFx = !!(legCurrency && reportingCcy && legCurrency !== reportingCcy && fxSpots)
  const fx = needsFx ? resolveFx(legCurrency, reportingCcy, fxSpots) : 1
  const amountHeader = needsFx ? `Amount (${reportingCcy})` : 'Amount'

  if (cashflows.length === 0) {
    return <div className="text-[#555b6e] text-3xs py-2">No cashflows</div>
  }

  return (
    <div className="font-mono text-3xs">
      {/* Header */}
      <div
        className={`grid gap-0.5 pb-1 border-b border-[#1e2235] text-[#555b6e] text-3xs ${
          legType === 'float' ? 'grid-cols-3' : 'grid-cols-3'
        }`}
      >
        <span>Period</span>
        {legType === 'float' ? (
          <>
            <span className="text-right" title="Forward rate + spread">
              Proj Rate
            </span>
            <span className="text-right" title="Period cashflow amount">
              {amountHeader}
            </span>
          </>
        ) : (
          <>
            <span className="text-right" title="Period cashflow amount">
              {amountHeader}
            </span>
            <span className="text-right" title="Discount Factor">
              DF
            </span>
          </>
        )}
      </div>

      {/* Rows */}
      {displayCashflows.map((cf, i) => {
        const signedNative = sign * cf.amount
        const reported = signedNative * fx

        return (
          <div
            key={i}
            className={`grid grid-cols-3 gap-0.5 py-0.5 ${
              i < displayCashflows.length - 1 ? 'border-b border-[#0c0e14]' : ''
            }`}
          >
            <span className="text-[#e0e0e0]">{formatDate(cf.date)}</span>
            {legType === 'float' ? (
              <>
                <span className="text-right text-[#8b8fa3]">
                  {cf.projectedRate != null ? formatFloatRate(cf.projectedRate) : '—'}
                </span>
                <span className={`text-right ${valueColorClass(reported)}`}>
                  <span>{formatAmount(reported)}</span>
                  {needsFx && (
                    <span className="block text-3xs text-[#555b6e]">
                      {legCurrency}{' '}
                      {Math.abs(signedNative).toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}{' '}
                      ×{fx.toFixed(4)}
                    </span>
                  )}
                </span>
              </>
            ) : (
              <>
                <span className={`text-right ${valueColorClass(reported)}`}>
                  <span>{formatAmount(reported)}</span>
                  {needsFx && (
                    <span className="block text-3xs text-[#555b6e]">
                      {legCurrency}{' '}
                      {Math.abs(signedNative).toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}{' '}
                      ×{fx.toFixed(4)}
                    </span>
                  )}
                </span>
                <span className="text-right text-[#8b8fa3]">
                  {cf.discountFactor != null ? formatDF(cf.discountFactor) : '—'}
                </span>
              </>
            )}
          </div>
        )
      })}

      {/* Expand/collapse */}
      {remaining > 0 && !expanded && (
        <button
          className="text-[#555b6e] text-3xs pt-1 hover:text-[#8b8fa3] transition-colors"
          onClick={() => setExpanded(true)}
        >
          ... {remaining} more
        </button>
      )}
      {expanded && remaining > 0 && (
        <button
          className="text-[#555b6e] text-3xs pt-1 hover:text-[#8b8fa3] transition-colors"
          onClick={() => setExpanded(false)}
        >
          Show less
        </button>
      )}
    </div>
  )
}
