'use client'

import type { ValuationResult } from '@irsforge/shared-pricing'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useLedgerClient } from '@/shared/hooks/use-ledger-client'
import { useSetFooterSlot } from '@/shared/layout/footer-slot-context'
import { CdsPanel } from './components/cds-panel'
import { LegColumn } from './components/leg-column'
import { LegComposer } from './components/leg-composer'
import { RightPanel, RightPanelSkeleton } from './components/right-panel'
import { TopBar } from './components/top-bar'
import { WhatIfBanner } from './components/what-if-banner'
import { usePricing } from './hooks/use-pricing'
import { usePricingInputs } from './hooks/use-pricing-inputs'
import { useWorkspace } from './hooks/use-workspace'
import { WorkspacePageSkeleton } from './page-skeleton'
import type { LegConfig } from './types'

function computeSwapMetrics(_legs: LegConfig[], valuation: ValuationResult | null) {
  // Total scheduled fixings = the longest cashflow stream across legs. For IRS
  // both legs share the same schedule, so either works; for CDS only the fixed
  // leg has cashflows; for CCY both legs have identical-length schedules; for
  // FX the "schedule" collapses to two payment dates. Picking the max matches
  // the ledger's periodic-schedule intuition without needing per-type branching.
  const legCashflows = valuation?.cashflows ?? []
  const fixingsTotal = legCashflows.reduce((max, cf) => Math.max(max, cf.length), 0)

  const now = new Date()
  const futureDates = legCashflows
    .flat()
    .filter((cf) => cf.date > now)
    .map((cf) => cf.date.getTime())
  const nextFixingDate = futureDates.length
    ? new Date(Math.min(...futureDates)).toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: '2-digit',
      })
    : null

  return { fixingsTotal, nextFixingDate }
}

function WorkspaceContent() {
  const workspace = useWorkspace()
  const inputs = usePricingInputs(workspace.swapConfig)

  const { valuation } = usePricing(
    workspace.swapConfig,
    inputs.curve,
    inputs.floatingRateIndex,
    inputs.observations,
    inputs.indicesByLeg,
    { book: inputs.curveBook ?? null, fxSpots: inputs.fxSpots },
  )
  const { activeParty } = useLedgerClient()

  const useLegComposer = workspace.swapType === 'FpML'

  const swapMetrics = useMemo(
    () => computeSwapMetrics(workspace.legs, valuation),
    [workspace.legs, valuation],
  )

  const footerData = useMemo(
    () => ({ valuation, swapConfig: workspace.swapConfig, curve: inputs.curve }),
    [valuation, workspace.swapConfig, inputs.curve],
  )
  useSetFooterSlot(footerData)

  // Track original NPV for What-If delta display
  const originalNPVRef = useRef<number | null>(null)
  useEffect(() => {
    if (workspace.mode === 'whatif' && originalNPVRef.current === null && valuation) {
      originalNPVRef.current = valuation.npv
    }
    if (workspace.mode !== 'whatif') {
      originalNPVRef.current = null
    }
  }, [workspace.mode, valuation])

  const rightPanelProps = {
    valuation,
    curve: inputs.curve,
    swapStatus: workspace.swapStatus,
    proposalRole: workspace.proposalRole,
    contractId: workspace.contractId,
    counterparty: workspace.counterparty,
    mode: workspace.mode,
    swapType: workspace.swapType,
    onExerciseAction: workspace.exerciseAction,
    onPropose: workspace.propose,
    onCounterpartyChange: workspace.setCounterparty,
    fixingsOutstanding: workspace.outstandingEffectsCount,
    fixingsTotal: swapMetrics.fixingsTotal,
    nextFixingDate: swapMetrics.nextFixingDate ?? '—',
    hasOutstandingEffects: workspace.outstandingEffectsCount > 0,
    isPastMaturity: workspace.isPastMaturity,
    pendingUnwind: workspace.pendingUnwind,
    unwindRole: workspace.unwindRole,
    workflowInstrument: workspace.workflowInstrument,
    workflowRegulators: workspace.workflowRegulators,
    workflowNotional:
      workspace.legs[0] && 'notional' in workspace.legs[0]
        ? String(workspace.legs[0].notional)
        : '0',
    currentNpv: valuation?.npv ?? null,
    onProposeTerminate: workspace.proposeTerminate,
    swapConfig: workspace.swapConfig,
    pricingCtx: inputs.pricingCtx,
    curveHistory: inputs.curveHistory,
    streamStatus: inputs.streamStatus,
    onApplyLegPatch: workspace.updateLeg
      ? (legIndex: number, patch: Partial<LegConfig>) => {
          for (const [k, v] of Object.entries(patch)) {
            workspace.updateLeg(legIndex, k, v as never)
          }
        }
      : undefined,
    activeParty: activeParty ?? '',
  }

  return (
    <div className="flex flex-col h-full" style={{ background: '#0c0e14' }}>
      <TopBar
        swapType={workspace.swapType}
        onTypeChange={workspace.setSwapType}
        dates={workspace.dates}
        onDateChange={workspace.updateDateField}
        mode={workspace.mode}
        whatIfActive={workspace.mode === 'whatif'}
        onToggleWhatIf={workspace.toggleWhatIf}
      />

      {workspace.mode === 'whatif' && (
        <WhatIfBanner originalNPV={originalNPVRef.current} scenarioNPV={valuation?.npv ?? null} />
      )}

      <div className="flex-1 overflow-hidden">
        {useLegComposer ? (
          <div className="grid h-full" style={{ gridTemplateColumns: '1fr 260px' }}>
            <LegComposer
              legs={workspace.legs}
              cashflows={valuation?.cashflows ?? []}
              legPVs={valuation?.legPVs ?? []}
              mode={workspace.mode}
              onUpdateLeg={(index, field, value) => workspace.updateLeg(index, field, value)}
              onAddLeg={workspace.addLeg}
              onRemoveLeg={workspace.removeLeg}
            />
            {inputs.curve === null ? <RightPanelSkeleton /> : <RightPanel {...rightPanelProps} />}
          </div>
        ) : (
          <div
            className="grid h-full"
            style={{
              gridTemplateColumns: '1fr 1fr 260px',
              gridTemplateRows: workspace.swapType === 'CDS' ? 'auto 1fr' : '1fr',
            }}
          >
            {workspace.swapType === 'CDS' && (
              <div style={{ gridColumn: '1 / 3', gridRow: 1 }}>
                <CdsPanel
                  creditSpread={workspace.creditSpread}
                  editable={workspace.mode !== 'active'}
                  onChange={(v) => workspace.setCreditSpread(v)}
                />
              </div>
            )}
            <div
              className="overflow-y-auto"
              style={{ gridColumn: 1, gridRow: workspace.swapType === 'CDS' ? 2 : 1 }}
            >
              {workspace.legs[0] && (
                <LegColumn
                  leg={workspace.legs[0]}
                  legIndex={0}
                  cashflows={valuation?.cashflows?.[0] ?? []}
                  legPV={valuation?.legPVs?.[0] ?? 0}
                  mode={workspace.mode}
                  onUpdateLeg={(field, value) => workspace.updateLeg(0, field, value)}
                  onNotionalChange={(v) => workspace.setLegNotional(0, v)}
                  onToggleDirection={workspace.toggleDirection}
                  pricingCtx={inputs.pricingCtx}
                  notionalLinked={workspace.notionalLinked}
                  onToggleNotionalLink={workspace.toggleNotionalLink}
                />
              )}
            </div>

            <div
              className="overflow-y-auto"
              style={{ gridColumn: 2, gridRow: workspace.swapType === 'CDS' ? 2 : 1 }}
            >
              {workspace.legs[1] && (
                <LegColumn
                  leg={workspace.legs[1]}
                  legIndex={1}
                  cashflows={valuation?.cashflows?.[1] ?? []}
                  legPV={valuation?.legPVs?.[1] ?? 0}
                  mode={workspace.mode}
                  onUpdateLeg={(field, value) => workspace.updateLeg(1, field, value)}
                  onNotionalChange={(v) => workspace.setLegNotional(1, v)}
                  onToggleDirection={workspace.toggleDirection}
                  pricingCtx={inputs.pricingCtx}
                />
              )}
            </div>

            <div
              className="overflow-y-auto"
              style={{ gridColumn: 3, gridRow: workspace.swapType === 'CDS' ? '1 / 3' : 1 }}
            >
              {inputs.curve === null ? <RightPanelSkeleton /> : <RightPanel {...rightPanelProps} />}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function WorkspacePage() {
  return (
    <Suspense fallback={<WorkspacePageSkeleton />}>
      <WorkspaceContent />
    </Suspense>
  )
}
