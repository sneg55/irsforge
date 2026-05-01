import type { IncomingMessage, ServerResponse } from 'node:http'
import { listProviders } from '../../providers/registry.js'
import { state } from '../../shared/state.js'
import { send } from '../http-utils.js'

export interface HealthDeps {
  mode: 'live' | 'demo'
}

export function handleHealth(_req: IncomingMessage, res: ServerResponse, deps: HealthDeps): void {
  send(res, 200, {
    status: 'ok',
    mode: deps.mode,
    providers: listProviders().map((p) => p.id),
    lastObservation: state.lastObservation,
    lastOvernightRate: state.lastOvernightRate,
    lastSuccessfulPublish: state.lastSuccessfulPublish,
    lastPublishError: state.lastPublishError,
    nextScheduledRun: state.nextScheduledRun,
  })
}
