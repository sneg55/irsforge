'use client'

import { useRouter } from 'next/navigation'
import { type ReactElement, useState } from 'react'
import { buildProposalFromClassification } from './build-proposal'
import { classify, parseFpml } from './classify'

interface ImportFpmlModalProps {
  workspaceBase: string
  onClose: () => void
}

/**
 * Blotter-level modal that accepts FpML XML (paste or upload), classifies it,
 * and navigates to the workspace with an `?import=<json>` query param. The
 * workspace URL-init hook (see `use-workspace-url-init.ts`) decodes the
 * payload, converts to SwapConfig, and seeds the reducer via HYDRATE_FROM_DRAFT.
 */
export function ImportFpmlModal({ workspaceBase, onClose }: ImportFpmlModalProps): ReactElement {
  const [xml, setXml] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [filename, setFilename] = useState<string | null>(null)
  const router = useRouter()

  function onSubmit() {
    setErr(null)
    try {
      const parsed = parseFpml(xml)
      const cls = classify(parsed)
      if (cls.productType === null) throw new Error(cls.reason)
      const proposal = buildProposalFromClassification(
        cls,
        parsed.effectiveDate,
        parsed.terminationDate,
      )
      const qs = new URLSearchParams({
        type: proposal.type,
        import: JSON.stringify(proposal.payload),
      })
      router.push(`${workspaceBase}?${qs.toString()}`)
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to import FpML')
    }
  }

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const f = event.target.files?.[0]
    if (!f) return
    setFilename(f.name)
    setXml(await f.text())
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      role="dialog"
      aria-label="Import FpML"
    >
      <div className="w-[600px] max-w-[90vw] rounded-lg border border-[#1e2235] bg-[#111320] p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Import FpML</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-3xs text-[#8b8fa3] hover:text-white"
          >
            Close
          </button>
        </div>

        <label className="mb-1 block text-3xs uppercase tracking-wide text-[#8b8fa3]">
          Paste FpML XML
        </label>
        <textarea
          value={xml}
          onChange={(e) => setXml(e.target.value)}
          rows={12}
          className="mb-3 w-full rounded border border-[#1e2235] bg-[#0a0c17] p-2 font-mono text-[11px] text-white"
          placeholder={
            '<FpML>\n  <trade>\n    <swap>\n      <swapStream>...</swapStream>\n    </swap>\n  </trade>\n</FpML>'
          }
        />

        <div className="mb-3 flex items-center gap-3">
          <label className="cursor-pointer rounded border border-[#1e2235] bg-[#1e2235] px-3 py-1 text-3xs text-[#8b8fa3] hover:text-white">
            <input
              type="file"
              accept=".xml,application/xml,text/xml"
              className="hidden"
              onChange={onFileChange}
            />
            Upload file
          </label>
          {filename && <span className="text-3xs text-[#8b8fa3]">{filename}</span>}
        </div>

        {err && (
          <div
            role="alert"
            className="mb-3 rounded border border-red-600/50 bg-red-900/20 p-2 text-[11px] text-red-400"
          >
            {err}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-[#1e2235] px-3 py-1 text-[11px] text-[#8b8fa3] hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={xml.trim().length === 0}
            className="rounded bg-blue-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Import
          </button>
        </div>
      </div>
    </div>
  )
}
