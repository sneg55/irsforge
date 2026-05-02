'use client'

import { usePathname } from 'next/navigation'
import { isOperatorParty, isRegulatorParty } from '@/shared/hooks/use-is-operator'
import { hintFromParty, partyMatchesHint } from '@/shared/ledger/party-match'
import type { CsaViewModel } from '../decode'
import { useDisputeRecord } from '../hooks/use-dispute-record'
import { useMarkStream } from '../hooks/use-mark-stream'
import { CsaFundingActions } from './csa-funding-actions'
import { CsaOperatorActions } from './csa-operator-actions'
import { DisputeCounterpartyActions } from './dispute-counterparty-actions'
import { MarkSparkline } from './mark-sparkline'
import { NettedBatchHistory } from './netted-batch-history'

interface Props {
  csa: CsaViewModel
  activeParty: string
}

export function CsaDrawer({ csa, activeParty }: Props) {
  const pathname = usePathname()
  const { history, latest, status } = useMarkStream(csa.partyA, csa.partyB)
  const { data: disputeRecord } = useDisputeRecord(csa.activeDispute)
  const isA = partyMatchesHint(csa.partyA, activeParty)
  const isOperator = isOperatorParty(activeParty)
  const isRegulator = isRegulatorParty(activeParty)
  const postedByMe = isA
    ? (csa.postedByA.get(csa.valuationCcy) ?? 0)
    : (csa.postedByB.get(csa.valuationCcy) ?? 0)
  const partyIdentifier = isA ? csa.partyA : csa.partyB
  // Drill-through to /blotter filtered by the OTHER party — the natural
  // meaning of "trades that drive this CSA's exposure for me".
  const otherParty = isA ? csa.partyB : csa.partyA
  const blotterHref = `${pathname.replace(/\/csa$/, '/blotter')}?counterparty=${encodeURIComponent(hintFromParty(otherParty))}`
  return (
    <div className="px-4 py-3 bg-zinc-900/70 border-b border-zinc-800">
      <div className="flex items-center justify-between">
        <div className="text-3xs uppercase tracking-wider text-zinc-500 mb-1">
          Mark stream ({status})
        </div>
        {!isOperator && !isRegulator && (
          <a
            href={blotterHref}
            data-testid="csa-view-trades-link"
            className="text-3xs text-blue-400 hover:text-blue-300 hover:underline"
          >
            View trades →
          </a>
        )}
      </div>
      <div>
        <MarkSparkline history={history} />
        <div className="text-3xs text-zinc-500 mt-1 font-mono">
          Latest:{' '}
          {latest ? (
            <>
              <span className={latest.exposure >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {latest.exposure.toLocaleString('en-US', {
                  style: 'currency',
                  currency: csa.valuationCcy,
                  maximumFractionDigits: 0,
                })}
              </span>
              <span className="text-zinc-600"> · </span>
              {new Date(latest.asOf).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
              })}
            </>
          ) : (
            '—'
          )}
        </div>
      </div>
      <div className="mt-3">
        <div className="text-3xs uppercase tracking-wider text-zinc-500 mb-1">Netted batches</div>
        <NettedBatchHistory csaCid={csa.contractId} />
      </div>
      {!isRegulator && (
        <div className="mt-4 flex flex-col items-end gap-2">
          {isOperator ? (
            <CsaOperatorActions
              csaCid={csa.contractId}
              pairPartyA={csa.partyA}
              pairPartyB={csa.partyB}
              ccy={csa.valuationCcy}
              state={csa.state}
              currentExposure={latest?.exposure ?? null}
            />
          ) : (
            <>
              <CsaFundingActions
                csaCid={csa.contractId}
                pairPartyA={csa.partyA}
                pairPartyB={csa.partyB}
                ccy={csa.valuationCcy}
                postedByMe={postedByMe}
                party={partyIdentifier}
                currentExposure={latest?.exposure ?? null}
                state={csa.state}
              />
              {disputeRecord && (csa.state === 'MarkDisputed' || csa.state === 'Escalated') && (
                <DisputeCounterpartyActions
                  csaCid={csa.contractId}
                  pairPartyA={csa.partyA}
                  pairPartyB={csa.partyB}
                  party={partyIdentifier}
                  disputer={disputeRecord.disputer}
                  counterMark={disputeRecord.counterMark}
                  reason={disputeRecord.reason}
                  notes={disputeRecord.notes}
                  ccy={csa.valuationCcy}
                  state={csa.state}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
