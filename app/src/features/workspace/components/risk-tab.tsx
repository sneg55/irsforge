'use client'

import {
  accrued,
  carry,
  clean,
  credit01,
  crossIndexBasisDv01,
  dirty,
  type FloatLegConfig,
  forwardNpv,
  fxDelta,
  type Horizon,
  keyRateDv01,
  type PricingContext,
  projectionDv01,
  roll,
  type SwapConfig,
  theta,
} from '@irsforge/shared-pricing'
import { useMemo, useState } from 'react'
import { formatAmount } from '../utils/format'
import { KrdTable } from './risk-tab.krd-table'

interface RiskTabProps {
  swapConfig: SwapConfig | null
  pricingCtx: PricingContext | null
}

type HorizonKey = 'nextFixing' | 'nextPayment' | 'd1' | 'd7' | 'd30' | 'd90'

const HORIZON_DEFS: { readonly [K in HorizonKey]: { label: string; horizon: Horizon } } = {
  nextFixing: { label: 'Next fix', horizon: { kind: 'toNextEvent', event: 'fixing' } },
  nextPayment: { label: 'Next pay', horizon: { kind: 'toNextEvent', event: 'payment' } },
  d1: { label: '+1D', horizon: { kind: 'deltaSeconds', seconds: 86400 } },
  d7: { label: '+7D', horizon: { kind: 'deltaSeconds', seconds: 604800 } },
  d30: { label: '+30D', horizon: { kind: 'deltaSeconds', seconds: 2592000 } },
  d90: { label: '+90D', horizon: { kind: 'deltaSeconds', seconds: 7776000 } },
}
const HORIZON_KEYS: readonly HorizonKey[] = ['nextFixing', 'nextPayment', 'd1', 'd7', 'd30', 'd90']

function SectionHeader({ label, color = '#3b82f6' }: { label: string; color?: string }) {
  return (
    <div
      className="flex items-center gap-1 text-[9px] font-semibold tracking-wider mb-2"
      style={{ color }}
    >
      <div className="w-[3px] h-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </div>
  )
}

function Row({
  label,
  value,
  faint,
  tooltip,
  tooltipKey,
  horizonLabel,
  horizonTestId,
}: {
  label: string
  value: string
  faint?: boolean
  tooltip?: string
  tooltipKey?: string
  horizonLabel?: string
  horizonTestId?: string
}) {
  return (
    <div
      className={`flex items-center justify-between py-0.5 text-3xs font-mono ${faint ? 'text-[#555b6e]' : ''}`}
    >
      <span
        className={faint ? 'text-[#555b6e]' : 'text-[#8b8fa3]'}
        data-tooltip-key={tooltipKey}
        title={tooltip}
      >
        {label}
        {horizonLabel && (
          <span className="ml-1 text-[#555b6e] text-[9px]" data-testid={horizonTestId}>
            {horizonLabel}
          </span>
        )}
      </span>
      <span className={faint ? 'text-[#555b6e]' : 'text-white'}>{value}</span>
    </div>
  )
}

export function RiskTab({ swapConfig, pricingCtx }: RiskTabProps) {
  const [horizonKey, setHorizonKey] = useState<HorizonKey>('nextFixing')
  const [showAllPillars, setShowAllPillars] = useState(false)
  const horizon = HORIZON_DEFS[horizonKey].horizon

  const metrics = useMemo(() => {
    if (!swapConfig || !pricingCtx) return null
    try {
      const krd = keyRateDv01(swapConfig, pricingCtx)
      const basis = projectionDv01(swapConfig, pricingCtx)
      const c01 = credit01(swapConfig, pricingCtx)
      const fx = fxDelta(swapConfig, pricingCtx)
      const accr = accrued(swapConfig, pricingCtx)
      const cln = clean(swapConfig, pricingCtx)
      const drt = dirty(swapConfig, pricingCtx)
      return { krd, basis, c01, fx, accr, cln, drt }
    } catch {
      return null
    }
  }, [swapConfig, pricingCtx])

  const timeMetrics = useMemo(() => {
    if (!swapConfig || !pricingCtx) return null
    try {
      return {
        theta: theta(swapConfig, pricingCtx, horizon),
        carry: carry(swapConfig, pricingCtx, horizon),
        roll: roll(swapConfig, pricingCtx, horizon),
        fwd: forwardNpv(
          swapConfig,
          pricingCtx,
          new Date(
            new Date(pricingCtx.curve.asOf).getTime() +
              (horizon.kind === 'deltaSeconds' ? horizon.seconds * 1000 : 86400 * 1000),
          ).toISOString(),
        ),
      }
    } catch {
      return null
    }
  }, [swapConfig, pricingCtx, horizon])

  if (!swapConfig || !pricingCtx) {
    return (
      <div className="p-3.5 text-3xs text-[#555b6e] font-mono">
        Risk metrics unavailable — oracle curve not loaded.
      </div>
    )
  }

  const parallelDv01 = metrics ? metrics.krd.reduce((s, e) => s + e.dv01, 0) : 0
  const hasBasisCtx = !!pricingCtx.book
  const isCds = swapConfig.type === 'CDS'
  const isMultiIndex = swapConfig.type === 'BASIS' || swapConfig.type === 'XCCY'
  const floatLegs = swapConfig.legs.filter((l): l is FloatLegConfig => l.legType === 'float')

  return (
    <div className="p-3.5 space-y-4">
      {/* KRD */}
      <section>
        <div className="flex items-start justify-between">
          <SectionHeader label="KEY-RATE DV01" />
          <label className="text-[9px] text-[#555b6e] flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={showAllPillars}
              onChange={(e) => setShowAllPillars(e.target.checked)}
            />
            Show all pillars
          </label>
        </div>
        {metrics ? (
          <KrdTable
            krds={metrics.krd.filter((e) => showAllPillars || Math.abs(e.dv01) > 0.5)}
            fullKrds={metrics.krd}
            parallel={parallelDv01}
          />
        ) : (
          <div className="text-3xs text-[#f59e0b]">Pricer error</div>
        )}
      </section>

      {/* Other sensitivities */}
      <section>
        <SectionHeader label="OTHER SENSITIVITIES" color="#8b5cf6" />
        {hasBasisCtx && metrics && (
          <Row label="Projection DV01" value={formatAmount(metrics.basis)} />
        )}
        {hasBasisCtx &&
          isMultiIndex &&
          metrics &&
          floatLegs.map((leg) => {
            const d = crossIndexBasisDv01(swapConfig, pricingCtx, leg.currency, leg.indexId)
            if (d === null) return null
            return (
              <Row
                key={`basis-${leg.currency}-${leg.indexId}`}
                label={`Basis ${leg.indexId}`}
                value={formatAmount(d)}
              />
            )
          })}
        {isCds && metrics && <Row label="Credit 01" value={formatAmount(metrics.c01)} />}
        {metrics?.fx.map((p) => (
          <Row key={p.pair} label={`FX Δ ${p.pair}`} value={formatAmount(p.delta)} />
        ))}
        {metrics && !hasBasisCtx && !isCds && metrics.fx.length === 0 && (
          <div className="text-3xs text-[#555b6e] font-mono">None applicable for this swap.</div>
        )}
      </section>

      {/* Time metrics */}
      <section>
        <SectionHeader label="TIME" color="#22c55e" />
        <div className="flex gap-1 flex-wrap mb-2">
          {HORIZON_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => setHorizonKey(key)}
              className={`px-1.5 py-0.5 text-[9px] font-mono rounded border ${
                key === horizonKey
                  ? 'bg-[#22c55e]/20 border-[#22c55e] text-[#22c55e]'
                  : 'bg-[#111320] border-[#1e2235] text-[#8b8fa3] hover:text-white'
              }`}
            >
              {HORIZON_DEFS[key].label}
            </button>
          ))}
        </div>
        {timeMetrics ? (
          <>
            <Row
              label="Theta"
              tooltipKey="theta"
              tooltip="Daily time decay: NPV change purely from one day passing."
              horizonLabel={HORIZON_DEFS[horizonKey].label}
              horizonTestId="theta-horizon"
              value={formatAmount(timeMetrics.theta)}
            />
            <Row
              label="Carry"
              tooltipKey="carry"
              tooltip="Return earned holding the swap from now to the horizon, before rate moves."
              horizonLabel={HORIZON_DEFS[horizonKey].label}
              value={formatAmount(timeMetrics.carry)}
            />
            <Row
              label="Roll"
              tooltipKey="roll"
              tooltip="Return earned by rolling down the curve (curve unchanged) over the horizon."
              horizonLabel={HORIZON_DEFS[horizonKey].label}
              value={formatAmount(timeMetrics.roll)}
            />
            <Row
              label="Forward NPV"
              tooltipKey="forward-npv"
              tooltip="Projected NPV at the selected horizon assuming current curve."
              horizonLabel={HORIZON_DEFS[horizonKey].label}
              value={formatAmount(timeMetrics.fwd)}
            />
          </>
        ) : (
          <div className="text-3xs text-[#f59e0b]">Horizon out of range</div>
        )}
      </section>

      {/* Accrued */}
      <section>
        <SectionHeader label="ACCRUED" color="#f59e0b" />
        {metrics ? (
          <>
            <Row
              label="Accrued"
              tooltipKey="accrued"
              tooltip="Coupon earned but not yet paid as of valuation date."
              value={formatAmount(metrics.accr)}
            />
            <Row
              label="Clean"
              tooltipKey="clean"
              tooltip="NPV excluding accrued coupon — the quoted price."
              value={formatAmount(metrics.cln)}
            />
            <Row
              label="Dirty"
              tooltipKey="dirty"
              tooltip="NPV including accrued coupon — what changes hands at settlement."
              value={formatAmount(metrics.drt)}
            />
            <Row
              label="clean + accrued − dirty"
              faint
              value={formatAmount(metrics.cln + metrics.accr - metrics.drt)}
            />
          </>
        ) : (
          <div className="text-3xs text-[#f59e0b]">Pricer error</div>
        )}
      </section>
    </div>
  )
}
