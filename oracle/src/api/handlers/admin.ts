import type { IncomingMessage, ServerResponse } from 'node:http'
import { writeGuard } from '../../authz/write-guard.js'
import { curvePointsToPillars } from '../../providers/nyfed/curve-builder.js'
import type { LedgerPublisher } from '../../services/ledger-publisher.js'
import type { SofrService } from '../../services/sofr-service.js'
import { SOFR_INDEX_RATE_ID } from '../../shared/generated/rate-families.js'
import { readBody, send } from '../http-utils.js'

export interface AdminDeps {
  sofrService: SofrService
  ledgerPublisher: LedgerPublisher
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0]
}

export async function handlePublishCurve(
  req: IncomingMessage,
  res: ServerResponse,
  deps: AdminDeps,
): Promise<void> {
  if (writeGuard(req, res)) return
  try {
    const raw = await readBody(req)
    const body = raw ? (JSON.parse(raw) as { date?: string }) : {}
    const effectiveDate = body.date ?? todayIso()
    const curve = await deps.sofrService.fetchAndBuildCurve(effectiveDate)
    const result = await deps.ledgerPublisher.publishCurve(effectiveDate, curve)
    try {
      const pillars = curvePointsToPillars(curve)
      const asOfIso = new Date(effectiveDate).toISOString()
      await deps.ledgerPublisher.publishDiscountCurve(
        'USD',
        asOfIso,
        pillars,
        'LinearZero',
        'Act360',
      )
      await deps.ledgerPublisher.publishProjectionCurve(
        'USD-SOFR',
        'USD',
        asOfIso,
        pillars,
        'LinearZero',
        'Act360',
      )
    } catch (err) {
      // Curve contracts are best-effort during publish; observations are still live.
      console.error(
        JSON.stringify({
          level: 'warn',
          event: 'curve_contract_publish_failed',
          error: String(err),
        }),
      )
    }
    send(res, 200, { effectiveDate, published: result.count, skipped: result.skipped })
  } catch (err) {
    send(res, 500, { error: err instanceof Error ? err.message : String(err) })
  }
}

export async function handlePublishRate(
  req: IncomingMessage,
  res: ServerResponse,
  deps: AdminDeps,
): Promise<void> {
  if (writeGuard(req, res)) return
  try {
    const body = JSON.parse(await readBody(req)) as {
      rateId: string
      effectiveDate: string
      value: number
    }
    const result = await deps.ledgerPublisher.publishRate(body)
    send(res, 200, { skipped: result.skipped })
  } catch (err) {
    send(res, 500, { error: err instanceof Error ? err.message : String(err) })
  }
}

export async function handleFetchSofr(
  req: IncomingMessage,
  res: ServerResponse,
  deps: AdminDeps,
): Promise<void> {
  if (writeGuard(req, res)) return
  try {
    const body = JSON.parse(await readBody(req)) as { date: string }
    const obs = await deps.sofrService.fetchSingleRate(SOFR_INDEX_RATE_ID, body.date)
    send(res, 200, obs)
  } catch (err) {
    send(res, 500, { error: err instanceof Error ? err.message : String(err) })
  }
}
