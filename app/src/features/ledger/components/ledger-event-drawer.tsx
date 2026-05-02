'use client'

import { PartyName } from 'canton-party-directory/ui'
import type { LedgerActivityEvent } from '../types'
import { kindColorClass } from '../utils'

interface Props {
  cid: string | null
  events: LedgerActivityEvent[]
  rawPayloadEnabled: boolean
  onClose: () => void
}

export function LedgerEventDrawer({ cid, events, rawPayloadEnabled, onClose }: Props) {
  if (cid === null) return null

  const related = events.filter((e) => e.contractId === cid || e.resultCid === cid)

  return (
    <aside className="fixed right-0 top-0 z-30 flex h-screen w-[480px] flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl">
      <header className="flex items-center justify-between border-b border-zinc-800 p-4">
        <div>
          <div className="text-3xs uppercase tracking-wider text-zinc-500">Contract</div>
          <div className="break-all font-mono text-xs text-blue-400">{cid}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded px-2 py-1 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
          aria-label="Close"
        >
          ×
        </button>
      </header>

      <div className="flex-1 overflow-auto p-4">
        {related.length === 0 ? (
          <p className="text-xs text-zinc-500">
            No buffered activity for this contract — only events since page load are stored.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="text-3xs uppercase tracking-wider text-zinc-500">
              Related events ({related.length})
            </div>
            {related.map((e, i) => (
              <div
                key={`${e.ts}-${e.kind}-${i}`}
                className="overflow-hidden rounded border border-zinc-800 bg-zinc-900 p-3 text-xs"
              >
                <div className="mb-1 flex items-start gap-2 font-mono text-3xs">
                  <span className={`shrink-0 font-semibold uppercase ${kindColorClass(e.kind)}`}>
                    {e.kind}
                  </span>
                  <span className="min-w-0 break-all text-zinc-200">{e.templateId}</span>
                  {e.choice ? <span className="shrink-0 text-amber-300">{e.choice}</span> : null}
                </div>
                <div className="text-zinc-500">
                  {e.party ? (
                    <>
                      by <PartyName identifier={e.party} /> ·{' '}
                    </>
                  ) : null}
                  {new Date(e.ts).toLocaleString()}
                </div>
                {rawPayloadEnabled && e.payload !== undefined ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-3xs uppercase tracking-wider text-zinc-500">
                      Payload
                    </summary>
                    <pre className="mt-2 max-h-64 overflow-auto rounded bg-zinc-950 p-2 text-3xs text-zinc-300">
                      {JSON.stringify(e.payload, null, 2)}
                    </pre>
                  </details>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
