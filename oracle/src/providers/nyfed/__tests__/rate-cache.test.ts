import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  bootstrapNyFedRateLookup,
  buildNyFedRateCache,
  hasNyFedProjectionProvider,
} from '../rate-cache.js'

describe('hasNyFedProjectionProvider', () => {
  const baseConfig = {
    floatingRateIndices: {
      'USD-SOFR': { currency: 'USD' },
      'EUR-ESTR': { currency: 'EUR' },
    },
    curves: {
      currencies: {
        USD: { projection: { provider: 'nyfed' } },
        EUR: { projection: { provider: 'demo-stub' } },
      },
    },
  }

  it('returns true when any index routes through nyfed', () => {
    expect(hasNyFedProjectionProvider(baseConfig)).toBe(true)
  })

  it('returns false when every index routes through demo-stub', () => {
    const config = {
      floatingRateIndices: { 'EUR-ESTR': { currency: 'EUR' } },
      curves: {
        currencies: { EUR: { projection: { provider: 'demo-stub' } } },
      },
    }
    expect(hasNyFedProjectionProvider(config)).toBe(false)
  })

  it('returns false when curves or indices are absent', () => {
    expect(hasNyFedProjectionProvider({})).toBe(false)
    expect(hasNyFedProjectionProvider({ floatingRateIndices: {} })).toBe(false)
    expect(hasNyFedProjectionProvider({ curves: { currencies: {} } })).toBe(false)
  })

  it('ignores indices whose currency has no curve entry', () => {
    const config = {
      floatingRateIndices: { 'XXX-?': { currency: 'XXX' } },
      curves: { currencies: {} },
    }
    expect(hasNyFedProjectionProvider(config)).toBe(false)
  })
})

describe('buildNyFedRateCache', () => {
  afterEach(() => vi.unstubAllGlobals())

  const okResponse = (refRates: unknown[]): Response =>
    new Response(JSON.stringify({ refRates }), { status: 200 })

  it('indexes SOFRAI entries by effectiveDate and returns a sync lookup', async () => {
    vi.stubGlobal('fetch', async () =>
      okResponse([
        { type: 'SOFRAI', effectiveDate: '2026-04-15', index: 1.05 },
        { type: 'SOFRAI', effectiveDate: '2026-04-16', index: 1.06 },
      ]),
    )
    const lookup = await buildNyFedRateCache({
      startDate: new Date('2026-04-15'),
      endDate: new Date('2026-04-16'),
      timeoutMs: 100,
    })
    expect(lookup('USD-SOFR', new Date('2026-04-15'))).toBe(1.05)
    expect(lookup('USD-SOFR', new Date('2026-04-16'))).toBe(1.06)
  })

  it('drops non-SOFRAI rate types and entries without a numeric index', async () => {
    vi.stubGlobal('fetch', async () =>
      okResponse([
        { type: 'EFFR', effectiveDate: '2026-04-15', index: 5.0 },
        { type: 'SOFRAI', effectiveDate: '2026-04-15', index: 'not-a-number' },
        { type: 'SOFRAI', effectiveDate: '2026-04-16', index: 1.06 },
      ]),
    )
    const lookup = await buildNyFedRateCache({
      startDate: new Date('2026-04-15'),
      endDate: new Date('2026-04-16'),
      timeoutMs: 100,
    })
    // Only the well-typed 04-16 SOFRAI lands.
    expect(lookup('USD-SOFR', new Date('2026-04-16'))).toBe(1.06)
    expect(() => lookup('USD-SOFR', new Date('2026-04-15'))).toThrow(/no SOFRAI entry/)
  })

  it('throws an error mentioning the indexId + date when the date is missing', async () => {
    vi.stubGlobal('fetch', async () => okResponse([]))
    const lookup = await buildNyFedRateCache({
      startDate: new Date('2026-04-15'),
      endDate: new Date('2026-04-15'),
      timeoutMs: 100,
    })
    expect(() => lookup('USD-SOFR-1M', new Date('2026-04-15'))).toThrow(/USD-SOFR-1M @ 2026-04-15/)
  })

  it('throws when the NYFed range fetch returns a non-2xx', async () => {
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response('upstream broke', { status: 503, statusText: 'Service Unavailable' }),
    )
    await expect(
      buildNyFedRateCache({
        startDate: new Date('2026-04-15'),
        endDate: new Date('2026-04-15'),
        timeoutMs: 100,
      }),
    ).rejects.toThrow(/NYFed back-fill range fetch failed \(503\): upstream broke/)
  })

  it('handles refRates being absent on the response shape', async () => {
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(
          JSON.stringify({
            /* no refRates */
          }),
          { status: 200 },
        ),
    )
    const lookup = await buildNyFedRateCache({
      startDate: new Date('2026-04-15'),
      endDate: new Date('2026-04-15'),
      timeoutMs: 100,
    })
    expect(() => lookup('USD-SOFR', new Date('2026-04-15'))).toThrow(/0 days cached/)
  })
})

describe('bootstrapNyFedRateLookup', () => {
  afterEach(() => vi.unstubAllGlobals())

  const baseConfigWithNyFed = {
    floatingRateIndices: { 'USD-SOFR': { currency: 'USD' } },
    curves: { currencies: { USD: { projection: { provider: 'nyfed' } } } },
    oracle: { fetchTimeoutMs: 100 },
  }

  it('returns undefined when no index routes through nyfed', async () => {
    const logger = { info: vi.fn(), error: vi.fn() }
    const result = await bootstrapNyFedRateLookup({
      config: {
        floatingRateIndices: { 'EUR-ESTR': { currency: 'EUR' } },
        curves: { currencies: { EUR: { projection: { provider: 'demo-stub' } } } },
        oracle: { fetchTimeoutMs: 100 },
      },
      logger,
    })
    expect(result).toBeUndefined()
    expect(logger.info).not.toHaveBeenCalled()
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('builds a lookup and emits the success log when fetch succeeds', async () => {
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response(
          JSON.stringify({
            refRates: [{ type: 'SOFRAI', effectiveDate: '2026-04-15', index: 1.05 }],
          }),
          { status: 200 },
        ),
    )
    const logger = { info: vi.fn(), error: vi.fn() }
    const result = await bootstrapNyFedRateLookup({
      config: baseConfigWithNyFed,
      logger,
      windowDays: 5,
    })
    expect(result).toBeTypeOf('function')
    expect(logger.info).toHaveBeenCalledWith({ event: 'nyfed_rate_cache_built', windowDays: 5 })
    expect(logger.error).not.toHaveBeenCalled()
  })

  it('downgrades fetch failures to undefined + an error log instead of throwing', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('network unreachable')
    })
    const logger = { info: vi.fn(), error: vi.fn() }
    const result = await bootstrapNyFedRateLookup({
      config: baseConfigWithNyFed,
      logger,
    })
    expect(result).toBeUndefined()
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'nyfed_rate_cache_failed' }),
    )
  })
})
