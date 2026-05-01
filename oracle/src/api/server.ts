import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { LedgerPublisher } from '../services/ledger-publisher.js'
import type { SofrService } from '../services/sofr-service.js'
import { handleFetchSofr, handlePublishCurve, handlePublishRate } from './handlers/admin.js'
import { handleHealth } from './handlers/health.js'
import { send, sendCorsPreflight } from './http-utils.js'

export interface HttpServerDeps {
  mode: 'live' | 'demo'
  sofrService: SofrService
  ledgerPublisher: LedgerPublisher
}

export function createHttpServer(deps: HttpServerDeps): Server {
  return createServer((req: IncomingMessage, res: ServerResponse) => {
    dispatch(req, res, deps).catch((err) => {
      send(res, 500, { error: err instanceof Error ? err.message : String(err) })
    })
  })
}

async function dispatch(
  req: IncomingMessage,
  res: ServerResponse,
  deps: HttpServerDeps,
): Promise<void> {
  if (req.method === 'OPTIONS') {
    sendCorsPreflight(res)
    return
  }
  const url = req.url ?? '/'
  const method = req.method ?? 'GET'

  if (method === 'GET' && url === '/api/health') {
    handleHealth(req, res, { mode: deps.mode })
    return
  }
  if (method === 'POST' && url === '/api/publish-curve') {
    await handlePublishCurve(req, res, {
      sofrService: deps.sofrService,
      ledgerPublisher: deps.ledgerPublisher,
    })
    return
  }
  if (method === 'POST' && url === '/api/publish-rate') {
    await handlePublishRate(req, res, {
      sofrService: deps.sofrService,
      ledgerPublisher: deps.ledgerPublisher,
    })
    return
  }
  if (method === 'POST' && url === '/api/fetch-sofr') {
    await handleFetchSofr(req, res, {
      sofrService: deps.sofrService,
      ledgerPublisher: deps.ledgerPublisher,
    })
    return
  }
  send(res, 404, { error: 'Not found' })
}
