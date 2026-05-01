'use client'

import type { SwapType } from '@irsforge/shared-pricing'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { Dispatch } from 'react'
import { useEffect } from 'react'
import { typedProposalToSwapConfig } from '@/features/fpml-import/to-swap-config'
import type { TypedProposal } from '@/features/fpml-import/types'
import { useDrafts } from './use-drafts'
import type { Action } from './use-workspace-reducer'

const IMPORTABLE_TYPES: ReadonlySet<string> = new Set<SwapType>(['IRS', 'OIS', 'BASIS', 'XCCY'])

export function useWorkspaceUrlInit(dispatch: Dispatch<Action>): void {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const { loadDraft, generateDraftId } = useDrafts()

  useEffect(() => {
    const draftParam = searchParams.get('draft')
    const swapParam = searchParams.get('swap')
    const importParam = searchParams.get('import')
    const typeParam = searchParams.get('type')

    if (swapParam) {
      dispatch({ type: 'HYDRATE_FROM_SWAP', contractId: swapParam })
      return
    }

    if (importParam && typeParam && IMPORTABLE_TYPES.has(typeParam)) {
      try {
        const payload = JSON.parse(importParam) as unknown
        const proposal = { type: typeParam, payload } as TypedProposal
        const config = typedProposalToSwapConfig(proposal)
        const draftId = generateDraftId()
        dispatch({ type: 'HYDRATE_FROM_DRAFT', draftId, config })
        // Drop the import/type params so a refresh doesn't re-hydrate stale state.
        const next = new URLSearchParams(searchParams.toString())
        next.delete('import')
        next.delete('type')
        const qs = next.toString()
        router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false })
      } catch {
        // Malformed import payload — ignore; workspace falls back to defaults.
      }
      return
    }

    if (draftParam) {
      dispatch({ type: 'SET_DRAFT_ID', draftId: draftParam })
      const saved = loadDraft(draftParam)
      if (saved) {
        dispatch({ type: 'HYDRATE_FROM_DRAFT', draftId: draftParam, config: saved })
      }
    }
  }, [searchParams, loadDraft, generateDraftId, dispatch, pathname, router])
}
