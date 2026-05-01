import { describe, expect, it, vi } from 'vitest'
import { type LocalExerciseEvent, ledgerActivityBus } from '../activity-bus'

describe('ledgerActivityBus', () => {
  it('delivers emitted events to every subscriber', () => {
    const subA = vi.fn()
    const subB = vi.fn()
    const unsubA = ledgerActivityBus.subscribe(subA)
    const unsubB = ledgerActivityBus.subscribe(subB)

    const evt: LocalExerciseEvent = {
      templateId: 'IRSForge:Csa.Csa:Csa',
      contractId: '00abc',
      choice: 'PostMargin',
      actAs: ['Alice'],
      resultCid: '00def',
      ts: 1700000000000,
    }
    ledgerActivityBus.emit(evt)

    expect(subA).toHaveBeenCalledWith(evt)
    expect(subB).toHaveBeenCalledWith(evt)

    unsubA()
    unsubB()
  })

  it('stops delivering after unsubscribe', () => {
    const sub = vi.fn()
    const unsub = ledgerActivityBus.subscribe(sub)
    unsub()
    ledgerActivityBus.emit({
      templateId: 't',
      contractId: 'c',
      choice: 'X',
      actAs: [],
      ts: 1,
    })
    expect(sub).not.toHaveBeenCalled()
  })

  it('isolates one subscriber throwing from the others', () => {
    const bad = vi.fn(() => {
      throw new Error('boom')
    })
    const good = vi.fn()
    const unsubBad = ledgerActivityBus.subscribe(bad)
    const unsubGood = ledgerActivityBus.subscribe(good)
    ledgerActivityBus.emit({
      templateId: 't',
      contractId: 'c',
      choice: 'X',
      actAs: [],
      ts: 1,
    })
    expect(good).toHaveBeenCalled()
    unsubBad()
    unsubGood()
  })

  it('does not deliver to subscribers added during emit', () => {
    const late = vi.fn()
    const first = vi.fn(() => {
      ledgerActivityBus.subscribe(late)
    })
    const unsubFirst = ledgerActivityBus.subscribe(first)
    ledgerActivityBus.emit({
      templateId: 't',
      contractId: 'c',
      choice: 'X',
      actAs: [],
      ts: 1,
    })
    expect(first).toHaveBeenCalledTimes(1)
    expect(late).not.toHaveBeenCalled()
    // late stays subscribed — caller must clean up any they added
    unsubFirst()
  })
})
