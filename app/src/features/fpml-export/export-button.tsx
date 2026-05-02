'use client'

import type { ReactElement } from 'react'
import type { SwapInstrumentPayload } from '@/shared/ledger/swap-instrument-types'
import { buildFpmlXml } from './build-xml'
import { isExportable, workflowToProposalPayload } from './workflow-to-proposal'

interface ExportFpmlButtonProps {
  swapType: string
  notional: string
  instrument: SwapInstrumentPayload | null
  workflowContractId: string | null
}

/**
 * Stage F per-workflow FpML export. Serialises the on-chain instrument into
 * an FpML XML file and triggers a browser download. Renders null when the
 * current swap isn't exportable today (BASIS/XCCY ride the Fpml instrument
 * whose TS interface is stripped down — widening is a follow-up) or the
 * instrument hasn't loaded yet.
 */
export function ExportFpmlButton({
  swapType,
  notional,
  instrument,
  workflowContractId,
}: ExportFpmlButtonProps): ReactElement | null {
  if (!isExportable(swapType)) return null
  if (!instrument) return null

  function onExport() {
    try {
      const proposal = workflowToProposalPayload({ swapType, notional }, instrument!)
      const xml = buildFpmlXml(proposal)
      const blob = new Blob([xml], { type: 'application/xml' })
      const url = URL.createObjectURL(blob)
      const shortId = (workflowContractId ?? 'export').slice(0, 10)
      const a = document.createElement('a')
      a.href = url
      a.download = `${swapType}-${shortId}.xml`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Export failed')
    }
  }

  return (
    <button
      type="button"
      onClick={onExport}
      className="w-full rounded border border-[#1e2235] bg-transparent py-2 text-2xs font-semibold tracking-wider text-[#555b6e] transition-colors hover:text-[#8b8fa3]"
    >
      EXPORT FPML
    </button>
  )
}
