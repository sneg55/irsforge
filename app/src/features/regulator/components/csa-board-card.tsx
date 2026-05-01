import { PartyName } from 'canton-party-directory/ui'
import type { CsaViewModel } from '@/features/csa/decode'
import { lawDisplay } from '@/features/csa/governing-law'
import { LedgerCidLink } from '@/features/ledger/components/ledger-cid-link'

const STATE_BADGE: Record<CsaViewModel['state'], string> = {
  Active: 'bg-zinc-800 text-zinc-300',
  MarginCallOutstanding: 'bg-yellow-900/40 text-yellow-300',
  MarkDisputed: 'bg-red-900/40 text-red-300',
  Escalated: 'bg-rose-900/40 text-rose-200',
}

const STATE_LABEL: Record<CsaViewModel['state'], string> = {
  Active: 'Active',
  MarginCallOutstanding: 'Margin call outstanding',
  MarkDisputed: 'Mark disputed',
  Escalated: 'Escalated',
}

function totalPosted(map: Map<string, number>): { ccy: string; amt: number }[] {
  return Array.from(map, ([ccy, amt]) => ({ ccy, amt }))
}

export function CsaBoardCard({ csa }: { csa: CsaViewModel }) {
  const aPosted = totalPosted(csa.postedByA)
  const bPosted = totalPosted(csa.postedByB)
  return (
    <div
      data-slot="csa-board-card"
      data-state={csa.state}
      className="rounded-lg border border-zinc-800 bg-zinc-950 p-4"
    >
      <header className="flex items-center justify-between">
        <span className="flex items-center gap-2 font-medium text-white">
          <PartyName identifier={csa.partyA} />
          <span className="text-zinc-600">↔</span>
          <PartyName identifier={csa.partyB} />
        </span>
        <span className={`rounded px-2 py-0.5 text-xs ${STATE_BADGE[csa.state]}`}>
          {STATE_LABEL[csa.state]}
        </span>
      </header>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-zinc-500">
          Threshold <PartyName identifier={csa.partyA} />
        </dt>
        <dd className="text-right font-mono font-medium text-zinc-100">
          {csa.thresholdDirA.toLocaleString()} {csa.valuationCcy}
        </dd>
        <dt className="text-zinc-500">
          Threshold <PartyName identifier={csa.partyB} />
        </dt>
        <dd className="text-right font-mono font-medium text-zinc-100">
          {csa.thresholdDirB.toLocaleString()} {csa.valuationCcy}
        </dd>
        <dt className="text-zinc-500">MTA</dt>
        <dd className="text-right font-mono font-medium text-zinc-100">
          {csa.mta.toLocaleString()} {csa.valuationCcy}
        </dd>
        <dt className="text-zinc-500">Valuation ccy</dt>
        <dd className="text-right font-mono font-medium text-zinc-100">{csa.valuationCcy}</dd>
        <dt className="text-zinc-500">ISDA MA</dt>
        <dd
          data-testid="csa-board-isda-ma"
          className="text-right font-mono font-medium text-zinc-100"
        >
          {csa.isdaMasterAgreementRef || '—'}
        </dd>
        <dt className="text-zinc-500">Governing law</dt>
        <dd data-testid="csa-board-governing-law" className="text-right font-medium text-zinc-100">
          {lawDisplay(csa.governingLaw)}
        </dd>
        <dt className="text-zinc-500">Initial Margin</dt>
        <dd
          data-testid="csa-board-im-amount"
          className="text-right font-mono font-medium text-zinc-100"
        >
          {csa.imAmount > 0 ? `${csa.imAmount.toLocaleString()} ${csa.valuationCcy}` : '—'}
        </dd>
        <dt className="text-zinc-500">
          Posted by <PartyName identifier={csa.partyA} />
        </dt>
        <dd className="text-right font-mono font-medium text-zinc-100">
          {aPosted.length === 0
            ? `0 ${csa.valuationCcy}`
            : aPosted.map((p) => `${p.amt.toLocaleString()} ${p.ccy}`).join(', ')}
        </dd>
        <dt className="text-zinc-500">
          Posted by <PartyName identifier={csa.partyB} />
        </dt>
        <dd className="text-right font-mono font-medium text-zinc-100">
          {bPosted.length === 0
            ? `0 ${csa.valuationCcy}`
            : bPosted.map((p) => `${p.amt.toLocaleString()} ${p.ccy}`).join(', ')}
        </dd>
      </dl>
      <footer className="mt-3 text-xs text-zinc-500">
        <LedgerCidLink cid={csa.contractId} prefixLabel="cid" truncate={24} />
      </footer>
    </div>
  )
}
