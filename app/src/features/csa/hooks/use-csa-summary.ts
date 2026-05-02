'use client'

import { useQuery } from '@tanstack/react-query'
import { useLedgerClient } from '@/shared/hooks/use-ledger-client'
import { type StreamPhase, streamPhase } from '@/shared/hooks/use-stream-phase'
import type { GoverningLaw } from '@/shared/ledger/csa-types'
import { hintFromParty, partyMatchesHint } from '@/shared/ledger/party-match'
import { pollIntervalWithBackoff } from '@/shared/ledger/poll-interval'
import { MARK_TEMPLATE_ID } from '@/shared/ledger/template-ids'
import type { ContractResult, CsaState, MarkToMarketPayload } from '@/shared/ledger/types'
import { decodeMark } from '../decode'
import { useCsas } from './use-csas'

// Rank CSA states for aggregation: a single outstanding call dominates a
// mixed portfolio, a disputed mark dominates otherwise-active pairs, and
// only an all-active set surfaces as "Active" in the summary.
const STATE_RANK: Record<CsaState, number> = {
  Active: 0,
  MarkDisputed: 1,
  MarginCallOutstanding: 2,
  // Escalated dominates everything else: a dispute that has reached the
  // operator window is the worst surfaceable summary state.
  Escalated: 3,
}
const RANK_TO_STATE: CsaState[] = ['Active', 'MarkDisputed', 'MarginCallOutstanding', 'Escalated']

export interface CsaSummary {
  count: number
  configured: boolean
  // Active-party-scoped posting totals summed across every CSA the party
  // participates in. `ownPosted` and `cptyPosted` are reported separately
  // because a secured party (one who holds counterparty collateral) and a
  // posting party see very different pictures of the same pot.
  ownPosted: number
  cptyPosted: number
  // Signed from the active party's perspective: positive means "I owe my
  // counterparties", negative means "my counterparties owe me". `null`
  // when any CSA in the set lacks a published mark — avoids compounding
  // a placeholder with a real number.
  exposure: number | null
  // Worst on-chain state across the set: MarginCallOutstanding >
  // MarkDisputed > Active.
  state: CsaState
  // Deduped hints (e.g. `RegulatorEU`) of every regulator party listed on
  // any CSA the active party participates in. Drives the "Regulator
  // observing" pill on the blotter COLLATERAL tile.
  regulatorHints: string[]
  // Stream-phase derived from the underlying mark poll. Surfaces whether
  // the summary is showing its first load (`initial`), a healthy feed
  // (`live`), a reconnecting/stale view (`reconnecting`), or a
  // disconnected feed (`disconnected`). Lets UI surfaces gate skeletons
  // and wire a LivenessDot without each consumer re-deriving phase.
  phase: StreamPhase
  // Raw React Query `isFetching` from the poll — useful for toast-free
  // refresh indicators that don't want the full three-state phase.
  isFetching: boolean
  // CSA metadata snapshot from the FIRST CSA in the active-party-scoped
  // set. Pure pass-through display: the workspace tile shows these without
  // aggregation (each pair has its own ISDA MA / governing law / IM).
  // Empty / zero / 'NewYork' when count === 0.
  isdaMasterAgreementRef: string
  governingLaw: GoverningLaw
  imAmount: number
  // CSA's valuation currency from the first CSA — used to format imAmount
  // alongside the right ccy. Empty when count === 0.
  valuationCcy: string
}

const EMPTY: CsaSummary = {
  count: 0,
  configured: false,
  ownPosted: 0,
  cptyPosted: 0,
  exposure: null,
  state: 'Active',
  regulatorHints: [],
  phase: 'initial',
  isFetching: false,
  isdaMasterAgreementRef: '',
  governingLaw: 'NewYork',
  imAmount: 0,
  valuationCcy: '',
}

const POLL_INTERVAL_MS = 10_000

interface LatestMarkByPair {
  [key: string]: { exposure: number; asOf: string }
}

function pairKey(partyA: string, partyB: string): string {
  return `${partyA}|${partyB}`
}

interface LatestMarkByPairQuery {
  latestByPair: LatestMarkByPair
  isFetching: boolean
  isSuccess: boolean
}

interface CsaAggregate {
  count: number
  ownPosted: number
  cptyPosted: number
  exposureSum: number
  anyMarkMissing: boolean
  worstRank: number
  regulatorHintSet: Set<string>
}

function emptyAggregate(): CsaAggregate {
  return {
    count: 0,
    ownPosted: 0,
    cptyPosted: 0,
    exposureSum: 0,
    anyMarkMissing: false,
    worstRank: 0,
    regulatorHintSet: new Set<string>(),
  }
}

/**
 * Fold one visible CSA into the running aggregate. Skips CSAs the active
 * party doesn't participate in. Splits posting/exposure sign by side and
 * tracks the worst on-chain state across the set.
 */
function foldCsa(
  acc: CsaAggregate,
  csa: ReturnType<typeof import('../decode').decodeCsa>,
  activeParty: string,
  latestByPair: LatestMarkByPair,
): CsaAggregate {
  const isA = partyMatchesHint(csa.partyA, activeParty)
  const isB = partyMatchesHint(csa.partyB, activeParty)
  if (!isA && !isB) return acc
  const postedA = csa.postedByA.get(csa.valuationCcy) ?? 0
  const postedB = csa.postedByB.get(csa.valuationCcy) ?? 0
  for (const reg of csa.regulators) acc.regulatorHintSet.add(hintFromParty(reg))
  const mark = latestByPair[pairKey(csa.partyA, csa.partyB)]
  const rank = STATE_RANK[csa.state]
  return {
    count: acc.count + 1,
    ownPosted: acc.ownPosted + (isA ? postedA : postedB),
    cptyPosted: acc.cptyPosted + (isA ? postedB : postedA),
    // Mark exposure is signed "A owes B"; flip for B-side active.
    exposureSum: acc.exposureSum + (mark ? (isA ? mark.exposure : -mark.exposure) : 0),
    anyMarkMissing: acc.anyMarkMissing || !mark,
    worstRank: rank > acc.worstRank ? rank : acc.worstRank,
    regulatorHintSet: acc.regulatorHintSet,
  }
}

/**
 * Query the MarkToMarket ACS once and keep a latest-per-pair index.
 *
 * Implemented as a polling query rather than a WebSocket subscription:
 * CSAs are few (1–10) but ACS snapshots are cheap, and a single poll
 * handles N pairs without fanning out N sockets. The /csa page still
 * uses `useMarkStream` for its per-drawer push feed.
 */
function useLatestMarkByPair(): LatestMarkByPairQuery {
  const { client } = useLedgerClient()
  const query = useQuery({
    queryKey: ['csa-marks-latest-by-pair', client?.authToken],
    queryFn: async (): Promise<LatestMarkByPair> => {
      if (!client) return {}
      const results = await client.query<ContractResult<MarkToMarketPayload>>(MARK_TEMPLATE_ID)
      const map: LatestMarkByPair = {}
      for (const r of results) {
        const m = decodeMark(r.contractId, r.payload)
        const k = pairKey(m.partyA, m.partyB)
        const prev = map[k]
        if (!prev || m.asOf > prev.asOf) {
          map[k] = { exposure: m.exposure, asOf: m.asOf }
        }
      }
      return map
    },
    enabled: !!client,
    refetchInterval: pollIntervalWithBackoff(POLL_INTERVAL_MS),
    refetchOnWindowFocus: false,
  })
  return {
    latestByPair: query.data ?? {},
    isFetching: query.isFetching,
    isSuccess: query.isSuccess,
  }
}

/**
 * Active-party-scoped aggregate of every visible CSA.
 *
 * Drives the blotter `CollateralZone` tile. The /csa page renders per-CSA
 * rows and opens a dedicated mark-stream subscription per expanded row;
 * this hook exists so the blotter header can summarise the same state
 * without fanning out N websockets.
 */
export function useCsaSummary(activeParty: string | null): CsaSummary {
  const { data } = useCsas()
  const { latestByPair, isFetching, isSuccess } = useLatestMarkByPair()

  // Treat the summary as a poll-backed "stream" for phase derivation.
  // The poll isn't a WS, but it refreshes on a 10s cadence and is the
  // only freshness signal the summary exposes — it behaves like an
  // always-open feed once the first fetch lands. We don't distinguish
  // between connecting/open here: any successful fetch flips to `open`.
  const pollStatus: 'idle' | 'connecting' | 'open' = isSuccess ? 'open' : 'connecting'
  const phase: StreamPhase = streamPhase(pollStatus, isSuccess)

  if (!activeParty) return { ...EMPTY, phase, isFetching }

  // Set on the aggregate ensures a regulator listed on multiple CSAs only
  // surfaces once on the blotter pill.
  const agg = data.reduce<CsaAggregate>(
    (acc, c) => foldCsa(acc, c, activeParty, latestByPair),
    emptyAggregate(),
  )

  if (agg.count === 0) return { ...EMPTY, phase, isFetching }

  // Pick the first visible CSA as the metadata source for the workspace
  // tile. The aggregation rolls up exposure/state across the whole set,
  // but ISDA MA ref / governing law / IM are per-CSA fields and the tile
  // is single-line — surfacing the first one keeps the UI honest in the
  // common 1-CSA case and at minimum shows something real in N-CSA cases.
  const firstVisible = data.find(
    (c) => partyMatchesHint(c.partyA, activeParty) || partyMatchesHint(c.partyB, activeParty),
  )

  return {
    count: agg.count,
    configured: true,
    ownPosted: agg.ownPosted,
    cptyPosted: agg.cptyPosted,
    exposure: agg.anyMarkMissing ? null : agg.exposureSum,
    state: RANK_TO_STATE[agg.worstRank],
    regulatorHints: Array.from(agg.regulatorHintSet).sort(),
    phase,
    isFetching,
    isdaMasterAgreementRef: firstVisible?.isdaMasterAgreementRef ?? '',
    governingLaw: firstVisible?.governingLaw ?? 'NewYork',
    imAmount: firstVisible?.imAmount ?? 0,
    valuationCcy: firstVisible?.valuationCcy ?? '',
  }
}
