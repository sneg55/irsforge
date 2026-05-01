import type { Config } from 'irsforge-shared-config'
import { getConcreteTemplateId } from '../providers/concrete-template-ids.js'
import { exerciseProviderChoice } from '../providers/onchain-publisher.js'
import { getProvider } from '../providers/registry.js'
import type { LedgerClient } from '../shared/ledger-client.js'
import { createLogger } from '../shared/logger.js'
import { FLOATING_RATE_INDEX_TEMPLATE_ID, FX_SPOT_TEMPLATE_ID } from '../shared/template-ids.js'

const logger = createLogger()

export async function seedIndices(client: LedgerClient, config: Config): Promise<void> {
  const indices = config.floatingRateIndices
  if (!indices) return

  for (const [indexId, idx] of Object.entries(indices)) {
    try {
      const existing = await client.query(FLOATING_RATE_INDEX_TEMPLATE_ID, { indexId })
      if (existing.length > 0) {
        logger.info({ event: 'seed_index_skip', indexId, reason: 'already exists' })
        continue
      }
      await client.create({
        templateId: FLOATING_RATE_INDEX_TEMPLATE_ID,
        payload: {
          operator: 'Operator',
          subscribers: [],
          regulators: ['Regulator'],
          indexId,
          currency: idx.currency,
          family: idx.family,
          compounding: idx.compounding,
          lookback: idx.lookback.toString(),
          floor: idx.floor !== null ? idx.floor.toString() : null,
        },
      })
      logger.info({ event: 'seed_index_created', indexId })
    } catch (err) {
      logger.error({ event: 'seed_index_error', indexId, error: String(err) })
    }
  }
}

export async function seedCurves(client: LedgerClient, config: Config): Promise<void> {
  const curves = config.curves
  if (!curves) return

  for (const [ccy, ccyCurve] of Object.entries(curves.currencies)) {
    const interpolation = curves.interpolation
    const dayCount = ccyCurve.dayCount

    // Discount: only seed when stub pillars are present in YAML. Real
    // providers (e.g. nyfed) seed their first curve via their own fetch
    // cycle, so absent pillars is a routine no-op for them.
    const discountPillars = config.demo?.stubCurves?.[ccy]?.discount?.pillars
    if (discountPillars) {
      await publishCurveViaProvider(
        client,
        ccyCurve.discount.provider,
        'Provider_PublishDiscountCurve',
        {
          currency: ccy,
          asOf: new Date().toISOString(),
          pillars: discountPillars.map((p) => ({
            tenorDays: p.tenorDays.toString(),
            zeroRate: p.zeroRate.toString(),
          })),
          interpolation,
          dayCount,
          constructionMetadata: JSON.stringify({ source: ccyCurve.discount.provider }),
        },
      )
    } else {
      logger.warn({
        event: 'seed_curve_skip',
        ccy,
        type: 'Discount',
        reason: 'no stub pillars in config',
        provider: ccyCurve.discount.provider,
      })
    }

    // Projection: keyed by indexId. Same rule — stub pillars present in
    // YAML triggers a per-(ccy, indexId) seed regardless of provider id.
    const stubProjections = config.demo?.stubCurves?.[ccy]?.projections
    if (stubProjections) {
      for (const [indexId, proj] of Object.entries(stubProjections)) {
        await publishCurveViaProvider(
          client,
          ccyCurve.projection.provider,
          'Provider_PublishProjectionCurve',
          {
            indexId,
            currency: ccy,
            asOf: new Date().toISOString(),
            pillars: proj.pillars.map((p) => ({
              tenorDays: p.tenorDays.toString(),
              zeroRate: p.zeroRate.toString(),
            })),
            interpolation,
            dayCount,
            constructionMetadata: JSON.stringify({ source: ccyCurve.projection.provider }),
          },
        )
      }
    } else {
      logger.warn({
        event: 'seed_curve_skip',
        ccy,
        type: 'Projection',
        reason: 'no stub projections in config',
        provider: ccyCurve.projection.provider,
      })
    }
  }
}

export interface FxSpotRow {
  contractId: string
  baseCcy: string
  quoteCcy: string
  rate: number
}

export interface FxSpotLedger {
  listFxSpots: () => Promise<FxSpotRow[]>
  createFxSpot: (args: {
    baseCcy: string
    quoteCcy: string
    rate: number
    asOf: Date
  }) => Promise<void>
  updateFxSpotRate: (args: { contractId: string; newRate: number; newAsOf: Date }) => Promise<void>
}

// Walk `demo.fxSpots` entries, creating an FxSpot per pair on first boot
// and exercising `UpdateRate` when the YAML value drifts from what's on
// chain. Keeping the ledger shape narrow (three methods) keeps the unit
// test pure — `fxSpotLedgerAdapter` handles all LedgerClient plumbing.
export async function seedFxSpots(
  ledger: FxSpotLedger,
  fxSpots: Record<string, number> | undefined,
  asOf: Date = new Date(),
): Promise<void> {
  if (!fxSpots) return
  const existing = await ledger.listFxSpots()
  const byPair = new Map(existing.map((r) => [`${r.baseCcy}${r.quoteCcy}`, r]))
  for (const [pair, rate] of Object.entries(fxSpots)) {
    const baseCcy = pair.slice(0, 3)
    const quoteCcy = pair.slice(3, 6)
    const match = byPair.get(`${baseCcy}${quoteCcy}`)
    if (!match) {
      await ledger.createFxSpot({ baseCcy, quoteCcy, rate, asOf })
      logger.info({ event: 'seed_fx_spot_created', pair, rate })
    } else if (match.rate !== rate) {
      await ledger.updateFxSpotRate({ contractId: match.contractId, newRate: rate, newAsOf: asOf })
      logger.info({ event: 'seed_fx_spot_updated', pair, oldRate: match.rate, newRate: rate })
    }
  }
}

export interface FxSpotParties {
  operator: string
  partyA: string
  partyB: string
  regulators: string[]
}

// Adapter that binds the `FxSpotLedger` interface to a live `LedgerClient`.
// The create path writes PartyA + PartyB as subscribers so Goldman and
// JPMorgan's blotter queries see the contract without the operator having
// to pre-seed it in InitImpl. Party ids must be the qualified `Hint::1220…`
// form — Canton rejects unqualified hints with DAML_AUTHORIZATION_ERROR
// even when the JWT actAs claim shares the short-name.
export function fxSpotLedgerAdapter(client: LedgerClient, parties: FxSpotParties): FxSpotLedger {
  return {
    async listFxSpots() {
      const rows = await client.query(FX_SPOT_TEMPLATE_ID)
      return rows.map((row) => {
        const r = row as {
          contractId: string
          payload: { baseCcy: string; quoteCcy: string; rate: string | number }
        }
        return {
          contractId: r.contractId,
          baseCcy: r.payload.baseCcy,
          quoteCcy: r.payload.quoteCcy,
          rate: typeof r.payload.rate === 'string' ? parseFloat(r.payload.rate) : r.payload.rate,
        }
      })
    },
    async createFxSpot({ baseCcy, quoteCcy, rate, asOf }) {
      await client.create({
        templateId: FX_SPOT_TEMPLATE_ID,
        payload: {
          operator: parties.operator,
          subscribers: [parties.partyA, parties.partyB],
          regulators: parties.regulators,
          baseCcy,
          quoteCcy,
          rate: rate.toString(),
          asOf: asOf.toISOString(),
        },
      })
    },
    async updateFxSpotRate({ contractId, newRate, newAsOf }) {
      await client.exercise({
        templateId: FX_SPOT_TEMPLATE_ID,
        contractId,
        choice: 'UpdateRate',
        argument: {
          newRate: newRate.toString(),
          newAsOf: newAsOf.toISOString(),
        },
      })
    },
  }
}

async function publishCurveViaProvider(
  client: LedgerClient,
  providerId: string,
  choice: 'Provider_PublishDiscountCurve' | 'Provider_PublishProjectionCurve',
  argument: Record<string, unknown>,
): Promise<void> {
  const provider = getProvider(providerId)
  const concreteTemplateId = getConcreteTemplateId(providerId)
  const providers = await client.query(concreteTemplateId)
  if (providers.length === 0) {
    logger.warn({ event: 'seed_provider_missing', providerId, concreteTemplateId })
    return
  }
  const providerCid = (providers[0] as { contractId: string }).contractId
  await exerciseProviderChoice(client, {
    interfaceTemplateId: provider.onchainInterfaceTemplateId,
    contractId: providerCid,
    choice,
    argument,
  })
  logger.info({
    event: 'seed_curve_published',
    providerId,
    choice,
    currency: argument['currency'],
  })
}
