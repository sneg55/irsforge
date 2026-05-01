import { beforeEach, describe, expect, it, test } from 'vitest'
import { ledgerActivityBus } from './activity-bus'
import { LedgerClient } from './client'
import { IRSFORGE_PACKAGE_ID } from './generated/package-ids'
import {
  failText,
  makeDamlJwt,
  mockFetch,
  okJson,
  PARTY_A_FULL,
  PARTY_B_FULL,
} from './test-helpers'

let fetchMock: ReturnType<typeof mockFetch>

beforeEach(() => {
  fetchMock = mockFetch()
})

describe('qualifyTemplateId', () => {
  test('prefixes unqualified template with generated package ID', async () => {
    const client = new LedgerClient(makeDamlJwt([PARTY_A_FULL]))
    fetchMock.mockResolvedValueOnce(okJson({ result: [] }))

    await client.query('Swap.Proposal:SwapProposal')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.path).toBe('/v1/query')
    expect(body.body.templateIds[0]).toBe(`${IRSFORGE_PACKAGE_ID}:Swap.Proposal:SwapProposal`)
  })

  test('passes through already-qualified template IDs', async () => {
    const client = new LedgerClient(makeDamlJwt([PARTY_A_FULL]))
    fetchMock.mockResolvedValueOnce(okJson({ result: [] }))

    await client.query('pkg-already:Swap.Proposal:SwapProposal')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).body.templateIds[0]).toBe(
      'pkg-already:Swap.Proposal:SwapProposal',
    )
  })
})

describe('listPackages', () => {
  test('returns array of package IDs', async () => {
    const client = new LedgerClient(makeDamlJwt([PARTY_A_FULL]))
    fetchMock.mockResolvedValueOnce(okJson({ result: ['pkg-1', 'pkg-2', 'pkg-3'] }))

    const pkgs = await client.listPackages()
    expect(pkgs).toEqual(['pkg-1', 'pkg-2', 'pkg-3'])
  })
})

describe('create', () => {
  test('sends templateId and payload, returns contractId', async () => {
    const client = new LedgerClient(makeDamlJwt([PARTY_A_FULL]))
    fetchMock.mockResolvedValueOnce(okJson({ result: { contractId: 'new-contract-123' } }))

    const result = await client.create('Swap.Proposal:SwapProposal', {
      proposer: PARTY_A_FULL,
      counterparty: PARTY_B_FULL,
      notional: '10000000',
    })

    expect(result.contractId).toBe('new-contract-123')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.path).toBe('/v1/create')
    expect(body.body.templateId).toBe(`${IRSFORGE_PACKAGE_ID}:Swap.Proposal:SwapProposal`)
    expect(body.body.payload.proposer).toBe(PARTY_A_FULL)
  })
})

describe('exercise', () => {
  test('sends choice and argument with qualified templateId', async () => {
    const client = new LedgerClient(makeDamlJwt([PARTY_A_FULL]))
    fetchMock.mockResolvedValueOnce(okJson({ result: { exerciseResult: 'done' } }))

    await client.exercise('Swap.Proposal:SwapProposal', 'contract-id-1', 'IrsAccept', {
      operator: 'Operator',
      regulators: ['Regulator'],
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.path).toBe('/v1/exercise')
    expect(body.body.templateId).toBe(`${IRSFORGE_PACKAGE_ID}:Swap.Proposal:SwapProposal`)
    expect(body.body.choice).toBe('IrsAccept')
    expect(body.body.contractId).toBe('contract-id-1')
    expect(body.body.argument.operator).toBe('Operator')
  })
})

describe('LedgerClient.exercise instrumentation', () => {
  it('emits a LocalExerciseEvent on successful exercise', async () => {
    const received: unknown[] = []
    const unsub = ledgerActivityBus.subscribe((e) => received.push(e))

    fetchMock.mockResolvedValueOnce(okJson({ result: { exerciseResult: '00result', events: [] } }))

    const client = new LedgerClient(makeDamlJwt([PARTY_A_FULL]), 'org')
    await client.exercise(
      'IRSForge:Csa.Csa:Csa',
      '00contract',
      'PostMargin',
      { x: 1 },
      {
        actAs: ['Alice'],
      },
    )

    expect(received).toHaveLength(1)
    expect(received[0]).toMatchObject({
      templateId: 'IRSForge:Csa.Csa:Csa',
      contractId: '00contract',
      choice: 'PostMargin',
      actAs: ['Alice'],
      resultCid: '00result',
    })
    unsub()
  })

  it('does not emit on exercise failure', async () => {
    const received: unknown[] = []
    const unsub = ledgerActivityBus.subscribe((e) => received.push(e))

    fetchMock.mockResolvedValueOnce(failText('nope', 400))

    const client = new LedgerClient(makeDamlJwt([PARTY_A_FULL]), 'org')
    await expect(client.exercise('t', 'c', 'Ch', {}, { actAs: ['A'] })).rejects.toThrow()

    expect(received).toHaveLength(0)
    unsub()
  })
})
