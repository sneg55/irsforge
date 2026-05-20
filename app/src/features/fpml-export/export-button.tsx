'use client'

import { type ReactElement, useState } from 'react'
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
 *
 * A confirm step lands before the download so the user reads the regulator-
 * notification language and the filename they're about to save. The export
 * itself stays local-only (Blob → anchor download); no ledger writes.
 */
export function ExportFpmlButton({
  swapType,
  notional,
  instrument,
  workflowContractId,
}: ExportFpmlButtonProps): ReactElement | null {
  const [confirmOpen, setConfirmOpen] = useState(false)
  if (!isExportable(swapType)) return null
  if (!instrument) return null

  const shortId = (workflowContractId ?? 'export').slice(0, 10)
  const filename = `${swapType}-${shortId}.xml`

  function downloadXml() {
    try {
      const proposal = workflowToProposalPayload({ swapType, notional }, instrument!)
      const xml = buildFpmlXml(proposal)
      const blob = new Blob([xml], { type: 'application/xml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      setConfirmOpen(false)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Export failed')
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        className="w-full rounded border border-[#1e2235] bg-transparent py-2 text-2xs font-semibold tracking-wider text-[#555b6e] transition-colors hover:text-[#8b8fa3]"
      >
        EXPORT FPML
      </button>
      {confirmOpen && (
        <div
          data-testid="fpml-confirm-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
        >
          <div className="w-[420px] rounded border border-[#1e2235] bg-[#111320] p-5 text-white">
            <h2 className="mb-3 text-sm font-semibold tracking-wider">EXPORT FPML</h2>
            <p className="mb-3 text-3xs leading-snug text-[#8b8fa3]">
              Serialises the on-chain {swapType} instrument as FpML 5.x XML and saves it locally as{' '}
              <span className="font-mono text-white">{filename}</span>. No ledger writes, no
              regulator notification — this is a read-only export for downstream systems (risk
              warehouse, trade reporting, counterparty confirms).
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="px-3 py-1.5 text-2xs text-[#555b6e] hover:text-[#8b8fa3]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={downloadXml}
                className="rounded bg-[#8b5cf6] px-3 py-1.5 text-2xs"
              >
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
