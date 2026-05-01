import type { OnChainPillar } from '../providers/nyfed/curve-builder.js'
import type { CurvePoint } from '../providers/nyfed/types.js'
import type { RateObservation } from '../providers/types.js'
import type { LedgerClient } from '../shared/ledger-client.js'
import {
  NYFED_OBSERVATION_TEMPLATE_ID,
  NYFED_PROVIDER_TEMPLATE_ID,
} from '../shared/template-ids.js'

// Re-exports kept for the existing test fixtures / mocks.
export const NYFED_ORACLE_TEMPLATE = NYFED_PROVIDER_TEMPLATE_ID
export const NYFED_OBSERVATION_TEMPLATE = NYFED_OBSERVATION_TEMPLATE_ID

export interface PublishCurveResult {
  skipped: boolean
  count: number
}

export interface PublishRateResult {
  skipped: boolean
}

export class LedgerPublisher {
  constructor(
    private readonly client: LedgerClient,
    private readonly interfaceTemplateId: string,
  ) {}

  async publishCurve(effectiveDate: string, curve: CurvePoint[]): Promise<PublishCurveResult> {
    if (curve.length === 0) throw new Error('publishCurve: empty curve')
    const existing = await this.client.query(NYFED_OBSERVATION_TEMPLATE, {
      rateId: curve[0].rateId,
      effectiveDate,
    })
    if (existing.length > 0) return { skipped: true, count: 0 }

    const providerCid = await this.findProviderContractId()
    await this.client.exercise({
      templateId: NYFED_ORACLE_TEMPLATE,
      contractId: providerCid,
      choice: 'PublishCurve',
      argument: {
        args: {
          effectiveDate,
          points: curve.map((p) => ({
            rateId: p.rateId,
            value: p.rate.toString(),
          })),
        },
      },
    })
    return { skipped: false, count: curve.length }
  }

  // eslint-disable-next-line max-params -- curve publish signature mirrors the on-ledger Daml choice 1:1; grouping into an object would diverge from the contract shape
  async publishDiscountCurve(
    currency: string,
    asOf: string,
    pillars: OnChainPillar[],
    interpolation: string,
    dayCount: string,
  ): Promise<void> {
    const providerCid = await this.findProviderContractId()
    await this.client.exercise({
      templateId: this.interfaceTemplateId,
      contractId: providerCid,
      choice: 'Provider_PublishDiscountCurve',
      argument: {
        currency,
        asOf,
        pillars: pillars.map((p) => ({
          tenorDays: p.tenorDays.toString(),
          zeroRate: p.zeroRate.toString(),
        })),
        interpolation,
        dayCount,
        constructionMetadata: JSON.stringify({
          source: 'nyfed',
          fetchedAt: new Date().toISOString(),
        }),
      },
    })
  }

  // eslint-disable-next-line max-params -- see publishDiscountCurve
  async publishProjectionCurve(
    indexId: string,
    currency: string,
    asOf: string,
    pillars: OnChainPillar[],
    interpolation: string,
    dayCount: string,
  ): Promise<void> {
    const providerCid = await this.findProviderContractId()
    await this.client.exercise({
      templateId: this.interfaceTemplateId,
      contractId: providerCid,
      choice: 'Provider_PublishProjectionCurve',
      argument: {
        indexId,
        currency,
        asOf,
        pillars: pillars.map((p) => ({
          tenorDays: p.tenorDays.toString(),
          zeroRate: p.zeroRate.toString(),
        })),
        interpolation,
        dayCount,
        constructionMetadata: JSON.stringify({
          source: 'nyfed',
          fetchedAt: new Date().toISOString(),
        }),
      },
    })
  }

  async publishRate(obs: RateObservation): Promise<PublishRateResult> {
    const existing = await this.client.query(NYFED_OBSERVATION_TEMPLATE, {
      rateId: obs.rateId,
      effectiveDate: obs.effectiveDate,
    })
    if (existing.length > 0) return { skipped: true }

    const providerCid = await this.findProviderContractId()
    await this.client.exercise({
      templateId: this.interfaceTemplateId,
      contractId: providerCid,
      choice: 'Provider_PublishRate',
      argument: {
        args: {
          rateId: obs.rateId,
          effectiveDate: obs.effectiveDate,
          value: obs.value.toString(),
        },
      },
    })
    return { skipped: false }
  }

  private async findProviderContractId(): Promise<string> {
    const rows = await this.client.query(NYFED_ORACLE_TEMPLATE)
    if (rows.length === 0) {
      throw new Error('No NYFedOracleProvider contract found on ledger')
    }
    return (rows[0] as { contractId: string }).contractId
  }
}
