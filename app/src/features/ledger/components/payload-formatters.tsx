'use client'

import { PartyName } from 'canton-party-directory/ui'
import type { ReactNode } from 'react'
import { LedgerCidLink } from './ledger-cid-link'
import {
  humanizeKey,
  isCcyMap,
  isInstrumentKey,
  looksLikeContractId,
  looksLikeDecimal,
  looksLikeIsoDate,
  looksLikeParty,
  str,
} from './payload-utils'

export {
  arr,
  humanizeKey,
  isCcyMap,
  isInstrumentKey,
  looksLikeContractId,
  looksLikeDecimal,
  looksLikeIsoDate,
  looksLikeParty,
  str,
} from './payload-utils'

export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem,1fr] items-baseline gap-3 py-1">
      <dt className="text-3xs uppercase tracking-wider text-zinc-500">{label}</dt>
      <dd className="min-w-0 break-words text-xs text-zinc-100">{children}</dd>
    </div>
  )
}

export function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="rounded border border-zinc-800 bg-zinc-900/40 p-3">
      {title ? (
        <h4 className="mb-1 text-3xs font-semibold uppercase tracking-wider text-zinc-400">
          {title}
        </h4>
      ) : null}
      <dl className="divide-y divide-zinc-800/60">{children}</dl>
    </section>
  )
}

export function MaybeParty({ value }: { value: string }) {
  if (looksLikeParty(value)) return <PartyName identifier={value} />
  return <span className="text-zinc-200">{value}</span>
}

export function PartyChip({ identifier }: { identifier: string }) {
  return (
    <span className="inline-flex items-center rounded bg-zinc-800/60 px-1.5 py-0.5 text-2xs text-zinc-100">
      <PartyName identifier={identifier} />
    </span>
  )
}

export function PartyList({ parties }: { parties: string[] }) {
  if (parties.length === 0) return <span className="text-zinc-500">none</span>
  return (
    <span className="flex flex-wrap gap-1">
      {parties.map((p) => (
        <PartyChip key={p} identifier={p} />
      ))}
    </span>
  )
}

export function Money({
  amount,
  ccy,
  signed = false,
}: {
  amount: string | number
  ccy?: string
  signed?: boolean
}) {
  const n = typeof amount === 'string' ? Number.parseFloat(amount) : amount
  if (!Number.isFinite(n)) return <span className="font-mono">{String(amount)}</span>
  const formatted = n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: signed ? 'always' : 'auto',
  })
  return (
    <span className="font-mono tabular-nums text-zinc-100">
      {formatted}
      {ccy ? <span className="ml-1 text-zinc-400">{ccy}</span> : null}
    </span>
  )
}

export function Numeric({ value }: { value: string | number }) {
  const n = typeof value === 'string' ? Number.parseFloat(value) : value
  if (!Number.isFinite(n)) return <span className="font-mono">{String(value)}</span>
  return <span className="font-mono tabular-nums text-zinc-100">{n.toLocaleString()}</span>
}

export function Pct({ value }: { value: string | number }) {
  const n = typeof value === 'string' ? Number.parseFloat(value) : value
  if (!Number.isFinite(n)) return <span className="font-mono">{String(value)}</span>
  return (
    <span className="font-mono tabular-nums text-zinc-100">
      {(n * 100).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })}%
    </span>
  )
}

export function DateValue({ iso }: { iso: string }) {
  if (!iso) return <span className="text-zinc-500">—</span>
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return <span className="font-mono text-zinc-200">{iso}</span>
  const d = new Date(t)
  return (
    <span className="font-mono text-zinc-200">
      {d.toISOString().replace('T', ' ').replace('.000Z', 'Z')}
    </span>
  )
}

export function ContractRef({ cid, label }: { cid: string; label?: string }) {
  if (!cid) return <span className="text-zinc-500">—</span>
  return <LedgerCidLink cid={cid} prefixLabel={label} truncate={12} />
}

export function CcyMap({ entries }: { entries: [string, string][] }) {
  if (entries.length === 0) return <span className="text-zinc-500">none</span>
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1">
      {entries.map(([ccy, amt]) => (
        <li key={ccy} className="font-mono text-xs">
          <Money amount={amt} ccy={ccy} signed />
        </li>
      ))}
    </ul>
  )
}

export type PillTone = 'neutral' | 'warn' | 'danger' | 'good' | 'info'

const TONE_CLASS: Record<PillTone, string> = {
  neutral: 'bg-zinc-800 text-zinc-200',
  warn: 'bg-amber-900/50 text-amber-200',
  danger: 'bg-rose-900/50 text-rose-200',
  good: 'bg-emerald-900/50 text-emerald-200',
  info: 'bg-blue-900/50 text-blue-200',
}

export function EnumPill({ value, tone = 'neutral' }: { value: string; tone?: PillTone }) {
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 font-mono text-2xs ${TONE_CLASS[tone]}`}
    >
      {value}
    </span>
  )
}

export function InstrumentKeyLine({ k }: { k: Record<string, unknown> }) {
  const id =
    typeof k.id === 'object' && k.id && 'unpack' in k.id
      ? String((k.id as { unpack: unknown }).unpack)
      : str(k.id)
  return (
    <span className="font-mono text-2xs text-zinc-200">
      {id}
      {k.version ? <span className="text-zinc-500"> v{str(k.version)}</span> : null}
    </span>
  )
}

// -- Generic value rendering -----------------------------------------------

function JsonBlob({ value }: { value: unknown }) {
  return (
    <pre className="max-h-32 overflow-auto rounded bg-zinc-950 p-2 font-mono text-3xs text-zinc-300">
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

function renderStringValue(v: string): ReactNode {
  if (looksLikeParty(v)) return <PartyChip identifier={v} />
  if (looksLikeContractId(v)) return <ContractRef cid={v} />
  if (looksLikeIsoDate(v)) return <DateValue iso={v} />
  if (looksLikeDecimal(v)) return <Numeric value={v} />
  return <span className="text-zinc-200">{v}</span>
}

function renderArrayValue(v: unknown[]): ReactNode {
  if (v.length === 0) return <span className="text-zinc-500">empty</span>
  if (isCcyMap(v)) return <CcyMap entries={v} />
  const strings = v.filter((x): x is string => typeof x === 'string')
  if (strings.length === v.length) {
    if (strings.every(looksLikeParty)) return <PartyList parties={strings} />
    return <span className="text-zinc-200">{strings.join(', ')}</span>
  }
  return <JsonBlob value={v} />
}

function renderObjectValue(o: Record<string, unknown>): ReactNode {
  if (typeof o.unpack === 'string')
    return <span className="font-mono text-zinc-200">{o.unpack}</span>
  if (isInstrumentKey(o)) return <InstrumentKeyLine k={o} />
  return <JsonBlob value={o} />
}

export function renderUnknownValue(v: unknown): ReactNode {
  if (v === null || v === undefined) return <span className="text-zinc-500">—</span>
  if (typeof v === 'boolean') return <EnumPill value={v ? 'true' : 'false'} tone="neutral" />
  if (typeof v === 'number') return <Numeric value={v} />
  if (typeof v === 'string') return renderStringValue(v)
  if (Array.isArray(v)) return renderArrayValue(v)
  if (typeof v === 'object') return renderObjectValue(v as Record<string, unknown>)
  return <span>{String(v)}</span>
}

export function FallbackSummary({ payload }: { payload: Record<string, unknown> }) {
  const entries = Object.entries(payload).filter(([, v]) => v !== null && v !== undefined)
  if (entries.length === 0) return null
  return (
    <Section title="Payload">
      {entries.map(([k, v]) => (
        <Row key={k} label={humanizeKey(k)}>
          {renderUnknownValue(v)}
        </Row>
      ))}
    </Section>
  )
}
