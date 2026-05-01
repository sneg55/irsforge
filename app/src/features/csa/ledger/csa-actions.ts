import type { LedgerClient } from '@/shared/ledger/client'
import type { DisputeReason } from '@/shared/ledger/csa-types'
import { CSA_TEMPLATE_ID } from '@/shared/ledger/template-ids'
import type { ContractResult, CsaPayload } from '@/shared/ledger/types'

/**
 * JSON API returns `{ result: { exerciseResult, events } }` wrapped by
 * `LedgerClient.exercise`. The on-chain Csa choices return the ContractId
 * of the updated Csa; narrow the payload so callers get the plain string.
 */
function extractCsaCid(raw: unknown): string {
  if (raw && typeof raw === 'object' && 'result' in raw) {
    const inner = raw.result
    if (inner && typeof inner === 'object' && 'exerciseResult' in inner) {
      const r = inner.exerciseResult
      if (typeof r === 'string') return r
    }
  }
  throw new Error('Csa exercise response missing exerciseResult')
}

export type CidResolver = () => Promise<string | null>

/**
 * Resolve the currently-active CSA contract id for a `(partyA, partyB)`
 * pair. The scheduler's mark-publisher archives + re-creates the CSA on
 * every `PublishMark` and `SettleVm` (Daml pattern: `create this with
 * <update>`), so any cid cached in the UI goes stale within a tick. The
 * party pair is the stable identity across the cid lineage.
 */
export function makeCsaPairResolver(
  client: LedgerClient,
  partyA: string,
  partyB: string,
): CidResolver {
  return async () => {
    const all = await client.query<ContractResult<CsaPayload>>(CSA_TEMPLATE_ID)
    const match = all.find((c) => c.payload.partyA === partyA && c.payload.partyB === partyB)
    return match?.contractId ?? null
  }
}

// Total attempts = 1 initial + up to 3 retries. Anything past ~4 attempts
// on a ~5-15s publish cadence means something else is wrong; we want the
// UI to surface a real error instead of silently spinning.
export const CONTENTION_ATTEMPTS = 4

function isContentionError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  // Canton 2.x JSON API surfaces archive races as either CONTRACT_NOT_FOUND
  // (contract already archived by a concurrent tx) or CONTRACT_KEY_NOT_FOUND.
  // The proxy fronts this as an HTTP 404 from `/v1/exercise`.
  return (
    msg.includes('CONTRACT_NOT_FOUND') ||
    msg.includes('CONTRACT_KEY_NOT_FOUND') ||
    msg.includes('(404)')
  )
}

/**
 * Exercise a CSA choice with archive-race retry.
 *
 * On `CONTRACT_NOT_FOUND` the helper waits a short backoff, re-resolves the
 * latest cid via `resolveFreshCid`, and re-exercises. The initial `csaCid`
 * is tried first so the common no-contention path stays a single round-trip.
 * Non-contention errors propagate immediately — only archive races are
 * transparent to the caller.
 */
export async function exerciseCsaWithRetry(
  client: LedgerClient,
  initialCid: string,
  choice: string,
  argument: Record<string, unknown>,
  resolveFreshCid?: CidResolver,
  attempts: number = CONTENTION_ATTEMPTS,
): Promise<unknown> {
  let cid = initialCid
  let lastErr: unknown = null
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await client.exercise(CSA_TEMPLATE_ID, cid, choice, argument)
    } catch (e) {
      lastErr = e
      if (!isContentionError(e) || !resolveFreshCid || attempt === attempts - 1) {
        throw e
      }
      await new Promise((r) => setTimeout(r, 120 + attempt * 200))
      const fresh = await resolveFreshCid()
      if (!fresh) {
        // Pair disappeared entirely — surface the original error.
        throw e
      }
      cid = fresh
    }
  }
  throw lastErr
}

export async function postCollateral(
  client: LedgerClient,
  csaCid: string,
  poster: string,
  ccy: string,
  amount: number,
  resolveFreshCid?: CidResolver,
): Promise<string> {
  const raw = await exerciseCsaWithRetry(
    client,
    csaCid,
    'PostCollateral',
    { poster, ccy, amount: amount.toString() },
    resolveFreshCid,
  )
  return extractCsaCid(raw)
}

export async function withdrawExcess(
  client: LedgerClient,
  csaCid: string,
  withdrawer: string,
  ccy: string,
  amount: number,
  resolveFreshCid?: CidResolver,
): Promise<string> {
  const raw = await exerciseCsaWithRetry(
    client,
    csaCid,
    'WithdrawExcess',
    { withdrawer, ccy, amount: amount.toString() },
    resolveFreshCid,
  )
  return extractCsaCid(raw)
}

export async function dispute(
  client: LedgerClient,
  csaCid: string,
  disputer: string,
  counterMark: number,
  reason: DisputeReason,
  notes: string,
  resolveFreshCid?: CidResolver,
): Promise<string> {
  const raw = await exerciseCsaWithRetry(
    client,
    csaCid,
    'Dispute',
    { disputer, counterMark: counterMark.toString(), reason, notes },
    resolveFreshCid,
  )
  return extractCsaCid(raw)
}

/**
 * Counterparty-controlled escalation: when the disputer's counterparty
 * disagrees with the proposed counter-mark, they invoke this to drag the
 * operator into the loop. Transitions the CSA from `MarkDisputed` →
 * `Escalated` (publisher continues to skip; only `AcknowledgeDispute`
 * by the operator can resolve from here).
 */
export async function escalateDispute(
  client: LedgerClient,
  csaCid: string,
  escalator: string,
  resolveFreshCid?: CidResolver,
): Promise<string> {
  const raw = await exerciseCsaWithRetry(
    client,
    csaCid,
    'EscalateDispute',
    { escalator },
    resolveFreshCid,
  )
  return extractCsaCid(raw)
}

/**
 * Bilateral counter-mark resolution: the disputer's counterparty agrees
 * to the proposed counter-mark, archiving the active DisputeRecord and
 * flipping the CSA back to `Active` with the agreed mark stamped as the
 * fresh `lastMarkCid`. Only valid while state is `MarkDisputed`; once
 * `Escalated`, only the operator can resolve.
 */
export async function agreeToCounterMark(
  client: LedgerClient,
  csaCid: string,
  agreer: string,
  asOf: string,
  snapshot: string,
  resolveFreshCid?: CidResolver,
): Promise<string> {
  const raw = await exerciseCsaWithRetry(
    client,
    csaCid,
    'AgreeToCounterMark',
    { agreer, asOf, snapshot },
    resolveFreshCid,
  )
  return extractCsaCid(raw)
}

export async function acknowledgeDispute(
  client: LedgerClient,
  csaCid: string,
  newAsOf: string,
  newExposure: number,
  newSnapshot: string,
  resolveFreshCid?: CidResolver,
): Promise<string> {
  const raw = await exerciseCsaWithRetry(
    client,
    csaCid,
    'AcknowledgeDispute',
    {
      newAsOf,
      newExposure: newExposure.toString(),
      newSnapshot,
    },
    resolveFreshCid,
  )
  return extractCsaCid(raw)
}
