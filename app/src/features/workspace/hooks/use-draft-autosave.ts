'use client'

import { useEffect } from 'react'
import type { SwapConfig, WorkspaceMode } from '../types'
import { useDrafts } from './use-drafts'

export function useDraftAutosave(args: {
  mode: WorkspaceMode
  draftId: string
  swapConfig: SwapConfig
}): void {
  const { mode, draftId, swapConfig } = args
  const { saveDraft } = useDrafts()

  useEffect(() => {
    if (mode === 'active') return
    saveDraft(draftId, swapConfig)
  }, [mode, draftId, swapConfig, saveDraft])
}
