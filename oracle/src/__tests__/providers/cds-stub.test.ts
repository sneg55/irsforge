import { describe, expect, it } from 'vitest'
import { CdsStubProvider } from '../../providers/cds-stub.js'

describe('CdsStubProvider', () => {
  const provider = new CdsStubProvider({
    referenceNames: ['TSLA'],
    defaultProb: 0.02,
    recovery: 0.4,
  })

  it('emits the configured DefaultProb for allowlisted ref name', async () => {
    const value = await provider.fetch('CDS/TSLA/DefaultProb')
    expect(value).toBe(0.02)
  })

  it('emits the configured Recovery for allowlisted ref name', async () => {
    const value = await provider.fetch('CDS/TSLA/Recovery')
    expect(value).toBe(0.4)
  })

  it('rejects non-CDS rate ids', async () => {
    await expect(provider.fetch('SOFR/ON')).rejects.toThrow(/CDS/)
  })

  it('rejects unknown ref names', async () => {
    await expect(provider.fetch('CDS/AAPL/Recovery')).rejects.toThrow(/AAPL/)
  })

  it('supportedRateIds returns the configured rate ids', () => {
    expect(provider.supportedRateIds).toEqual(['CDS/TSLA/DefaultProb', 'CDS/TSLA/Recovery'])
  })

  it('returns whatever stub rates config provides (no hardcoded values)', async () => {
    const custom = new CdsStubProvider({
      referenceNames: ['TSLA'],
      defaultProb: 0.05,
      recovery: 0.25,
    })
    expect(await custom.fetch('CDS/TSLA/DefaultProb')).toBe(0.05)
    expect(await custom.fetch('CDS/TSLA/Recovery')).toBe(0.25)
  })
})
