'use client'
import { PartyName } from 'canton-party-directory/ui'
import { usePathname, useRouter } from 'next/navigation'
import {
  coverageFraction,
  csaStatusColorClass,
  deriveCsaStatus,
  formatCoveragePct,
} from '@/features/blotter/exposure-header/format'
import { lawDisplay } from '@/features/csa/governing-law'
import type { CsaSummary } from '@/features/csa/hooks/use-csa-summary'
import { ROUTES } from '@/shared/constants/routes'

interface Props {
  cpty: string
  summary: CsaSummary
}

export function ReferenceCsaTile({ cpty, summary }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  // Derive orgId from current path (/org/<orgId>/...) so navigation stays org-scoped.
  const orgId = pathname.split('/')[2] ?? ''
  if (!summary.configured) {
    return (
      <div
        data-testid="no-csa-tile"
        className="flex-1 bg-[#0a0c12] px-3 py-2.5 opacity-50 cursor-default"
      >
        <div className="text-3xs font-semibold uppercase tracking-wider text-[#555b6e]">No CSA</div>
        <div className="text-3xs text-[#555b6e] mt-1 font-mono">unconfigured</div>
      </div>
    )
  }
  const status = deriveCsaStatus(summary.state, summary.ownPosted, summary.exposure)
  const colors = csaStatusColorClass(status)
  const pctLabel = formatCoveragePct(summary.ownPosted, summary.exposure)
  const frac = coverageFraction(summary.ownPosted, summary.exposure)
  const fillPct = frac === null ? 0 : Math.round(frac * 100)
  return (
    <div
      data-testid="csa-tile"
      onClick={() => router.push(ROUTES.ORG_CSA(orgId))}
      className="flex-1 bg-[#0a0c12] px-3 py-2.5 cursor-pointer hover:bg-[#10131e]"
    >
      <div className="flex justify-between items-center mb-1">
        <span className="text-3xs font-semibold uppercase tracking-wider text-[#555b6e]">
          CSA
          {cpty ? (
            <>
              {' · '}
              <PartyName identifier={cpty} />
            </>
          ) : (
            ''
          )}
        </span>
        <span className="text-[#555b6e] text-3xs">↗</span>
      </div>
      <div
        data-testid="csa-tile-isda-row"
        className="flex justify-between text-3xs font-mono text-[#7a8093] mb-1"
      >
        <span title={summary.isdaMasterAgreementRef || undefined}>
          ISDA: {summary.isdaMasterAgreementRef || '—'}
        </span>
        <span>{lawDisplay(summary.governingLaw)}</span>
      </div>
      <div className="flex justify-between text-3xs font-mono">
        <span className="text-[#c9c9d4]">Coverage</span>
        <span className={`px-1.5 rounded text-3xs ${colors.pill}`}>{colors.label}</span>
      </div>
      <div className="h-[6px] bg-[#1a1d2e] rounded my-1.5 overflow-hidden">
        <div
          className="h-full rounded"
          style={{
            width: `${fillPct}%`,
            background: 'linear-gradient(90deg,#22c55e 0%,#22c55e 50%,#f59e0b 80%,#ef4444 100%)',
          }}
        />
      </div>
      <div className="flex justify-between text-3xs font-mono text-[#c9c9d4]">
        <span>{pctLabel}</span>
        <span>${Math.round(summary.ownPosted).toLocaleString()}</span>
      </div>
      <div
        data-testid="csa-tile-im-row"
        className="flex justify-between text-3xs font-mono text-[#7a8093] mt-1"
      >
        <span>Initial Margin</span>
        <span>
          {summary.imAmount > 0
            ? `${Math.round(summary.imAmount).toLocaleString()} ${summary.valuationCcy}`
            : '—'}
        </span>
      </div>
    </div>
  )
}
