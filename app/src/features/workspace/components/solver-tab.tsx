'use client'

import {
  keyRateDv01,
  type PricingContext,
  type SwapConfig,
  solveHedgeNotional,
  solveParRate,
  solveSpread,
  solveUnwindPv,
} from '@irsforge/shared-pricing'
import { useEffect, useMemo, useState } from 'react'
import type { LegConfig, SwapType } from '../types'
import { formatAmount, formatFixedRate, formatNotional } from '../utils/format'

type Variable = 'parRate' | 'spread' | 'hedgeNotional' | 'unwindPv'
type Target = 'npv' | 'dv01' | 'modDuration' | 'krd'

function initialVariable(swapType: SwapType): Variable {
  switch (swapType) {
    case 'BASIS':
    case 'XCCY':
      return 'spread'
    case 'IRS':
    case 'OIS':
    case 'CDS':
    case 'CCY':
    case 'FX':
    case 'ASSET':
    case 'FpML':
      return 'parRate'
  }
}

interface SolverTabProps {
  swapType: SwapType
  swapConfig: SwapConfig | null
  pricingCtx: PricingContext | null
  onApplyLegPatch?: (legIndex: number, patch: Partial<LegConfig>) => void
}

interface PairingRule {
  valid: boolean
  requiresKrdPillar?: boolean
  reason?: string
}

const VARIABLE_LABELS: Record<Variable, string> = {
  parRate: 'Par rate',
  spread: 'Spread',
  hedgeNotional: 'Hedge notional',
  unwindPv: 'Unwind PV',
}
const TARGET_LABELS: Record<Target, string> = {
  npv: 'NPV',
  dv01: 'DV01',
  modDuration: 'Mod Duration',
  krd: 'KRD (pillar)',
}

const VALID_TARGETS: Record<Variable, Target[]> = {
  parRate: ['npv'],
  spread: ['npv'],
  unwindPv: ['npv'],
  hedgeNotional: ['dv01', 'krd'],
}

function rule(variable: Variable, target: Target): PairingRule {
  if (!VALID_TARGETS[variable].includes(target)) return { valid: false }
  if (variable === 'hedgeNotional' && target === 'krd')
    return { valid: true, requiresKrdPillar: true }
  return { valid: true }
}

export function SolverTab({ swapType, swapConfig, pricingCtx, onApplyLegPatch }: SolverTabProps) {
  const [variable, setVariable] = useState<Variable>(initialVariable(swapType))
  const [target, setTarget] = useState<Target>('npv')
  const [pillarIndex, setPillarIndex] = useState(0)

  useEffect(() => {
    if (!VALID_TARGETS[variable].includes(target)) {
      setTarget(VALID_TARGETS[variable][0])
    }
  }, [variable, target])

  const pairing = rule(variable, target)

  const krdPillars = useMemo(() => {
    if (!swapConfig || !pricingCtx) return [] as number[]
    try {
      return keyRateDv01(swapConfig, pricingCtx).map((e) => e.pillarTenorDays)
    } catch {
      return []
    }
  }, [swapConfig, pricingCtx])

  const result = useMemo(() => {
    if (!swapConfig || !pricingCtx || !pairing.valid) return null
    try {
      if (variable === 'parRate')
        return { kind: 'parRate' as const, value: solveParRate(swapConfig, pricingCtx) }
      if (variable === 'unwindPv')
        return { kind: 'unwindPv' as const, value: solveUnwindPv(swapConfig, pricingCtx) }
      if (variable === 'spread') {
        const legIdx = swapConfig.legs.findIndex((l) => l.legType === 'float')
        if (legIdx < 0)
          return { kind: 'error' as const, message: 'No float leg to solve spread on' }
        return {
          kind: 'spread' as const,
          legIndex: legIdx,
          value: solveSpread(swapConfig, pricingCtx, legIdx),
        }
      }
      // hedgeNotional — same swap acts as both target and hedge for Stage F
      // (full cross-swap hedging picks up once the blotter-row picker lands).
      const pillarDays = pairing.requiresKrdPillar ? krdPillars[pillarIndex] : undefined
      const objective = pairing.requiresKrdPillar ? 'keyRate' : 'dv01'
      return {
        kind: 'hedgeNotional' as const,
        value: solveHedgeNotional(
          swapConfig,
          pricingCtx,
          swapConfig,
          pricingCtx,
          objective,
          pillarDays,
        ),
      }
    } catch (e) {
      return { kind: 'error' as const, message: (e as Error).message }
    }
  }, [swapConfig, pricingCtx, variable, target, pairing, pillarIndex, krdPillars])

  if (!swapConfig || !pricingCtx) {
    return (
      <div className="p-3.5 text-3xs text-[#555b6e] font-mono">
        Solver unavailable — oracle curve not loaded.
      </div>
    )
  }

  const applyParRate = () => {
    if (!onApplyLegPatch || result?.kind !== 'parRate') return
    if (!Number.isFinite(result.value) || Math.abs(result.value) > 10) {
      alert('Solver result out of range — adjust inputs')
      return
    }
    const legIdx = swapConfig.legs.findIndex((l) => l.legType === 'fixed')
    if (legIdx >= 0) onApplyLegPatch(legIdx, { rate: result.value })
  }
  const applySpread = () => {
    if (!onApplyLegPatch || result?.kind !== 'spread') return
    if (!Number.isFinite(result.value) || Math.abs(result.value) > 10) {
      alert('Solver result out of range — adjust inputs')
      return
    }
    onApplyLegPatch(result.legIndex, { spread: result.value })
  }
  const copyValue = () => {
    if (result && 'value' in result && typeof result.value === 'number') {
      void navigator.clipboard?.writeText(String(result.value))
    }
  }

  const formatResult = () => {
    if (!result) return '—'
    if (result.kind === 'error') return 'Error'
    if (result.kind === 'parRate' || result.kind === 'spread') return formatFixedRate(result.value)
    return formatAmount(result.value)
  }

  return (
    <div className="p-3.5 space-y-3">
      <div className="flex items-center gap-1 text-[9px] font-semibold tracking-wider text-[#8b5cf6]">
        <div className="w-[3px] h-2.5 rounded-sm bg-[#8b5cf6]" />
        SOLVE
      </div>

      <div className="space-y-2 text-3xs font-mono">
        <div>
          <label className="text-[#555b6e] block mb-1">Variable</label>
          <select
            value={variable}
            onChange={(e) => setVariable(e.target.value as Variable)}
            className="w-full bg-[#111320] text-white rounded px-2 py-1 border border-[#1e2235] outline-hidden"
          >
            {(Object.keys(VARIABLE_LABELS) as Variable[]).map((v) => (
              <option key={v} value={v}>
                {VARIABLE_LABELS[v]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[#555b6e] block mb-1">Target</label>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value as Target)}
            className="w-full bg-[#111320] text-white rounded px-2 py-1 border border-[#1e2235] outline-hidden"
          >
            {(Object.keys(TARGET_LABELS) as Target[]).map((t) => {
              const allowed = VALID_TARGETS[variable].includes(t)
              return (
                <option key={t} value={t} disabled={!allowed}>
                  {TARGET_LABELS[t]} = 0{!allowed ? ' — n/a' : ''}
                </option>
              )
            })}
          </select>
        </div>

        {pairing.requiresKrdPillar && krdPillars.length > 0 && (
          <div>
            <label className="text-[#555b6e] block mb-1">Pillar</label>
            <select
              value={pillarIndex}
              onChange={(e) => setPillarIndex(Number(e.target.value))}
              className="w-full bg-[#111320] text-white rounded px-2 py-1 border border-[#1e2235] outline-hidden"
            >
              {krdPillars.map((p, i) => (
                <option key={p} value={i}>
                  {p} days
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="rounded p-2 border border-[#1e2235]" style={{ background: '#111320' }}>
        <div className="text-[#555b6e] text-[9px] mb-1">Result</div>
        <div className="text-white text-sm font-mono font-bold tracking-tight">
          {formatResult()}
        </div>
        {result?.kind === 'error' && (
          <div className="text-[9px] text-[#ef4444] mt-1 font-mono break-all">{result.message}</div>
        )}
        {result && result.kind === 'hedgeNotional' && (
          <div className="text-[9px] text-[#8b8fa3] mt-1 font-mono">
            DV01-neutral hedge notional ({formatNotional(result.value)})
          </div>
        )}
      </div>

      <div className="flex gap-1.5">
        {result?.kind === 'parRate' && (
          <button
            onClick={applyParRate}
            className="flex-1 py-1.5 bg-[#8b5cf6] text-white rounded text-3xs font-semibold hover:bg-[#7c3aed]"
          >
            Apply to workspace
          </button>
        )}
        {result?.kind === 'spread' && (
          <button
            onClick={applySpread}
            className="flex-1 py-1.5 bg-[#8b5cf6] text-white rounded text-3xs font-semibold hover:bg-[#7c3aed]"
          >
            Apply to workspace
          </button>
        )}
        {result && (result.kind === 'hedgeNotional' || result.kind === 'unwindPv') && (
          <button
            onClick={copyValue}
            className="flex-1 py-1.5 bg-[#1e2235] text-white rounded text-3xs font-semibold hover:bg-[#2a3050]"
          >
            Copy value
          </button>
        )}
      </div>
    </div>
  )
}
