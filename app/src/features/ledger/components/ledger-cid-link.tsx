'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ROUTES } from '@/shared/constants/routes'

export interface LedgerCidLinkProps {
  cid: string
  prefixLabel?: string
  truncate?: number
  className?: string
}

export function LedgerCidLink({ cid, prefixLabel, truncate = 8, className }: LedgerCidLinkProps) {
  const params = useParams()
  const orgId =
    typeof params?.orgId === 'string'
      ? params.orgId
      : Array.isArray(params?.orgId)
        ? params.orgId[0]
        : ''

  const short = cid.length > truncate ? `${cid.slice(0, truncate)}…` : cid

  return (
    <Link
      href={ROUTES.ORG_LEDGER_CID(orgId, cid)}
      title={cid}
      className={
        className ??
        'inline-flex items-center gap-1 rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px] text-blue-400 hover:border-zinc-600 hover:bg-zinc-800'
      }
    >
      {prefixLabel ? <span className="text-zinc-500">{prefixLabel}:</span> : null}
      <span>{short}</span>
    </Link>
  )
}
