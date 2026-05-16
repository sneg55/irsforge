'use client'

import type { ReactNode } from 'react'
import { stripPackagePrefix } from '../utils'
import { FallbackSummary } from './payload-formatters'
import {
  CsaProposalSummary,
  CsaSummary,
  DisputeRecordSummary,
  MarkSummary,
  NettedBatchSummary,
  SettlementAuditSummary,
  ShortfallSummary,
} from './payload-summary-csa'
import { CurveSnapshotSummary, CurveSummary, ObservationSummary } from './payload-summary-oracle'
import {
  AcceptAckSummary,
  MaturedSwapSummary,
  SwapProposalSummary,
  SwapWorkflowSummary,
  TerminatedSwapSummary,
} from './payload-summary-swap'

type Renderer = (p: Record<string, unknown>) => ReactNode

const EXACT_RENDERERS: Record<string, Renderer> = {
  'Swap.Workflow:SwapWorkflow': (p) => <SwapWorkflowSummary p={p} />,
  'Swap.Workflow:MaturedSwap': (p) => <MaturedSwapSummary p={p} />,
  'Swap.Terminate:TerminatedSwap': (p) => <TerminatedSwapSummary p={p} />,
  'Csa.Csa:Csa': (p) => <CsaSummary p={p} />,
  'Csa.Mark:MarkToMarket': (p) => <MarkSummary p={p} />,
  'Csa.Shortfall:MarginShortfall': (p) => <ShortfallSummary p={p} />,
  'Csa.Netting:NettedBatch': (p) => <NettedBatchSummary p={p} />,
  'Csa.Dispute:DisputeRecord': (p) => <DisputeRecordSummary p={p} />,
  'Csa.Proposal:CsaProposal': (p) => <CsaProposalSummary p={p} />,
  'Audit.SettlementAudit:SettlementAudit': (p) => <SettlementAuditSummary p={p} />,
  'Oracle.Curve:Curve': (p) => <CurveSummary p={p} />,
  'Oracle.CurveSnapshot:CurveSnapshot': (p) => <CurveSnapshotSummary p={p} />,
}

function patternRenderer(tail: string): Renderer | null {
  if (tail.startsWith('Swap.') && tail.endsWith('Proposal') && tail.includes('Proposal:')) {
    return (p) => <SwapProposalSummary p={p} />
  }
  if (tail.endsWith('AcceptAck')) return (p) => <AcceptAckSummary p={p} />
  if (tail.includes('Observation:Observation')) return (p) => <ObservationSummary p={p} />
  return null
}

interface Props {
  templateId: string
  payload: unknown
}

export function PayloadSummary({ templateId, payload }: Props) {
  if (!payload || typeof payload !== 'object') return null
  const p = payload as Record<string, unknown>
  const tail = stripPackagePrefix(templateId)
  const renderer = EXACT_RENDERERS[tail] ?? patternRenderer(tail)
  if (renderer) return renderer(p)
  return <FallbackSummary payload={p} />
}
