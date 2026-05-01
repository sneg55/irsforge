import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { SwapConfig } from '../../types'
import { useDraftAutosave } from '../use-draft-autosave'

const saveDraft = vi.fn()
vi.mock('../use-drafts', () => ({
  useDrafts: () => ({ saveDraft }),
}))

beforeEach(() => saveDraft.mockReset())

const cfg = {
  type: 'IRS',
  legs: [],
  tradeDate: new Date(),
  effectiveDate: new Date(),
  maturityDate: new Date(),
} as unknown as SwapConfig

describe('useDraftAutosave', () => {
  test('skips save when mode is active', () => {
    renderHook(() => useDraftAutosave({ mode: 'active', draftId: 'd1', swapConfig: cfg }))
    expect(saveDraft).not.toHaveBeenCalled()
  })

  test('saves when mode is draft', () => {
    renderHook(() => useDraftAutosave({ mode: 'draft', draftId: 'd1', swapConfig: cfg }))
    expect(saveDraft).toHaveBeenCalledWith('d1', cfg)
  })
})
