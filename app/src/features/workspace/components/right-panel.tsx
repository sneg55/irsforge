'use client'

import type {
  DiscountCurve,
  PricingContext,
  SwapConfig,
  ValuationResult,
} from '@irsforge/shared-pricing'
import { usePartyDirectory } from 'canton-party-directory/react'
import { useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { useCsaSummary } from '@/features/csa/hooks/use-csa-summary'
import { useConfig } from '@/shared/contexts/config-context'
import { useIsOperator, useIsRegulator } from '@/shared/hooks/use-is-operator'
import type { SwapInstrumentPayload } from '@/shared/ledger/swap-instrument-types'
import type { CurveStreamEntry } from '@/shared/ledger/useCurveStream'
import type { PendingUnwind } from '../hooks/use-workspace-reducer'
import type { LegConfig, StatusAction, SwapStatus, SwapType, WorkspaceMode } from '../types'
import { AttributionDrawer } from './attribution-drawer'
import { OnChainPanel } from './on-chain-panel'
import { ReferenceStrip, ReferenceStripSkeleton } from './reference-strip'
import { RiskTab } from './risk-tab'
import { SolverTab } from './solver-tab'
import { type TabKey, TabStrip } from './tab-strip'
import { UnwindModal } from './unwind-modal'
import { ValuationTab } from './valuation-tab'

interface RightPanelProps {
  valuation: ValuationResult | null
  curve: DiscountCurve | null
  swapStatus: SwapStatus | null
  proposalRole: 'proposer' | 'counterparty' | null
  contractId: string | null
  counterparty: string
  mode: WorkspaceMode
  swapType: SwapType
  onExerciseAction: (
    action: StatusAction,
    extraArgs?: Record<string, unknown>,
  ) => Promise<void> | void
  onPropose: () => void
  onCounterpartyChange: (party: string) => void
  fixingsOutstanding: number
  fixingsTotal: number
  nextFixingDate: string
  hasOutstandingEffects?: boolean
  isPastMaturity?: boolean
  pendingUnwind: PendingUnwind | null
  unwindRole: 'proposer' | 'counterparty' | null
  workflowInstrument: SwapInstrumentPayload | null
  workflowRegulators: readonly string[]
  workflowNotional: string
  currentNpv: number | null
  onProposeTerminate: (args: { pvAmount: number; reason: string }) => Promise<void>
  swapConfig: SwapConfig | null
  pricingCtx: PricingContext | null
  curveHistory: CurveStreamEntry[]
  streamStatus: 'idle' | 'connecting' | 'open' | 'fallback'
  onApplyLegPatch?: (legIndex: number, patch: Partial<LegConfig>) => void
  activeParty: string
}

const TABS: { key: TabKey; label: string }[] = [
  { key: 'valuation', label: 'Valuation' },
  { key: 'risk', label: 'Risk' },
  { key: 'solver', label: 'Solver' },
]

export function RightPanel({
  valuation,
  curve,
  swapStatus,
  proposalRole,
  contractId,
  counterparty,
  mode,
  swapType,
  onExerciseAction,
  onPropose,
  onCounterpartyChange,
  fixingsOutstanding,
  fixingsTotal,
  nextFixingDate,
  hasOutstandingEffects = false,
  isPastMaturity = false,
  pendingUnwind,
  unwindRole,
  workflowInstrument,
  workflowRegulators,
  workflowNotional,
  currentNpv,
  onProposeTerminate,
  swapConfig,
  pricingCtx,
  curveHistory,
  streamStatus,
  onApplyLegPatch,
  activeParty,
}: RightPanelProps) {
  const [isUnwindModalOpen, setIsUnwindModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('valuation')
  const csaSummary = useCsaSummary(activeParty)
  const { directory } = usePartyDirectory()
  const counterpartyOptions = directory
    .entries()
    .filter((e) => e.hint && e.hint !== 'Operator' && e.hint !== 'Regulator')
  const isOperator = useIsOperator()
  const isRegulator = useIsRegulator()
  const { config } = useConfig()
  const assetObservablesEnabled = config?.observables?.ASSET?.enabled ?? false

  return (
    <div className="min-h-full" style={{ background: '#0a0c12' }}>
      {/* 1. Actions first — Accept/Reject, Propose, Settle, etc. must stay above
         the fold at 1280×720. */}
      {mode === 'draft' ? (
        isOperator || isRegulator ? (
          <div data-testid="propose-blocked-operator" className="p-3.5 border-b border-[#1e2235]">
            <div className="flex items-center gap-1 text-3xs font-semibold tracking-wider text-[#555b6e] mb-2">
              <div className="w-[3px] h-2.5 rounded-sm bg-[#555b6e]" />
              PROPOSE SWAP
            </div>
            <p className="text-[#8b8fa3] text-3xs leading-relaxed">
              {isRegulator
                ? 'Regulators observe swaps — they don’t propose. Switch to a trader account to create a proposal.'
                : 'Operators don’t propose swaps — they co-sign on behalf of the platform. Switch to a trader account to create a proposal.'}
            </p>
          </div>
        ) : (
          <div className="p-3.5 border-b border-[#1e2235]">
            <div className="flex items-center gap-1 text-3xs font-semibold tracking-wider text-[#8b5cf6] mb-2">
              <div className="w-[3px] h-2.5 rounded-sm bg-[#8b5cf6]" />
              PROPOSE SWAP
            </div>
            <div className="mb-3">
              <label className="text-[#555b6e] text-3xs block mb-1">Counterparty</label>
              <select
                className="w-full bg-[#111320] text-white text-2xs rounded px-2 py-1.5 border border-[#1e2235] outline-hidden appearance-none cursor-pointer hover:border-[#555b6e]/50 focus:border-[#8b5cf6]/50 font-mono"
                style={{
                  colorScheme: 'dark',
                  WebkitAppearance: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5' viewBox='0 0 8 5'%3E%3Cpath fill='%23555b6e' d='M0 0l4 5 4-5z'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 8px center',
                }}
                value={counterparty}
                onChange={(e) => onCounterpartyChange(e.target.value)}
              >
                <option value="" className="bg-[#111320]">
                  Select counterparty...
                </option>
                {counterpartyOptions.map((entry) => (
                  <option key={entry.hint} value={entry.hint} className="bg-[#111320]">
                    {entry.displayName}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="w-full py-2 bg-[#8b5cf6] text-white rounded font-semibold text-2xs tracking-wider hover:bg-[#7c3aed] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={onPropose}
              disabled={!counterparty}
            >
              PROPOSE
            </button>
          </div>
        )
      ) : (
        <OnChainPanel
          swapStatus={swapStatus}
          proposalRole={proposalRole}
          contractId={contractId}
          counterparty={counterparty}
          fixingsOutstanding={fixingsOutstanding}
          fixingsTotal={fixingsTotal}
          nextFixingDate={nextFixingDate}
          hasOutstandingEffects={hasOutstandingEffects}
          isPastMaturity={isPastMaturity}
          isOperator={isOperator}
          swapType={swapType}
          assetObservablesEnabled={assetObservablesEnabled}
          pendingUnwind={pendingUnwind}
          unwindRole={unwindRole}
          workflowInstrument={workflowInstrument}
          workflowRegulators={workflowRegulators}
          workflowNotional={workflowNotional}
          onExerciseAction={onExerciseAction}
          onOpenUnwindModal={() => setIsUnwindModalOpen(true)}
        />
      )}

      {/* 2. Tabbed analytics — Valuation / Risk / Solver only. Curve + CSA live
          in the reference strip below; Attribution lives in the collapsible
          drawer. */}
      <TabStrip tabs={TABS} active={activeTab} onChange={setActiveTab}>
        {activeTab === 'valuation' && <ValuationTab valuation={valuation} />}
        {activeTab === 'risk' && <RiskTab swapConfig={swapConfig} pricingCtx={pricingCtx} />}
        {activeTab === 'solver' && (
          <SolverTab
            swapType={swapType}
            swapConfig={swapConfig}
            pricingCtx={pricingCtx}
            onApplyLegPatch={onApplyLegPatch}
          />
        )}
      </TabStrip>
      {/* Gate the strip on "no curve + no history" as the initial-load
          proxy. The SOFR tile conveys freshness via its own inline color
          cue, so no separate LivenessDot is added here — see Task 17
          spec (the reference strip already had a LivenessDot surrogate
          via the tile). */}
      {curve === null && curveHistory.length === 0 ? (
        <ReferenceStripSkeleton />
      ) : (
        <ReferenceStrip
          curve={curve}
          history={curveHistory}
          cpty={counterparty}
          summary={csaSummary}
        />
      )}
      {mode !== 'draft' && (
        <AttributionDrawer
          mode="live"
          swapConfig={swapConfig}
          pricingCtx={pricingCtx}
          curveHistory={curveHistory}
          streamStatus={streamStatus}
        />
      )}

      <UnwindModal
        isOpen={isUnwindModalOpen}
        onClose={() => setIsUnwindModalOpen(false)}
        currentNpv={currentNpv ?? 0}
        onSubmit={async (pvAmount, reason) => {
          await onProposeTerminate({ pvAmount, reason })
        }}
      />
    </div>
  )
}

export function RightPanelSkeleton() {
  return (
    <div className="p-4 space-y-3">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-8 w-36" />
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-4 h-3 w-20" />
      <Skeleton className="h-8 w-36" />
      <Skeleton className="h-3 w-24" />
    </div>
  )
}
