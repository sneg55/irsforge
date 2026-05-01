'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import type { BlotterTab } from '../types'

const VALID_TABS = new Set<BlotterTab>(['active', 'proposals', 'drafts', 'matured', 'unwound'])

// All URL-bound state for the blotter route. Centralised here so the page
// component does not have to thread `searchParams.get('…')` plumbing
// alongside its data-fetching and render logic.
//
// Two URL params are recognised:
//   • `tab=<active|proposals|drafts|matured|unwound>` — which tab is active.
//     `tab=active` is dropped from the URL (it's the default) so the
//     baseline path stays clean.
//   • `counterparty=<hint>` — when set, all real-trade row sets are
//     filtered to rows whose counterparty matches the hint. Cleared via
//     `clearCounterpartyFilter`. Hint is the bare `PartyA`-style string;
//     the page passes it through `partyMatchesHint` for the actual check.
//
// `workspaceBase` / `csaBase` are sibling-route helpers derived from the
// current pathname so deep-links from this page stay stable across
// org-routing prefixes.
export interface BlotterUrlState {
  activeTab: BlotterTab
  handleTabChange: (tab: BlotterTab) => void
  counterpartyHint: string | null
  clearCounterpartyFilter: () => void
  workspaceBase: string
  csaBase: string
}

export function useBlotterUrlState(): BlotterUrlState {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const urlTab = searchParams.get('tab') as BlotterTab | null
  const [activeTab, setActiveTab] = useState<BlotterTab>(
    urlTab && VALID_TABS.has(urlTab) ? urlTab : 'active',
  )

  const handleTabChange = (tab: BlotterTab) => {
    setActiveTab(tab)
    const params = new URLSearchParams(searchParams.toString())
    if (tab === 'active') {
      params.delete('tab')
    } else {
      params.set('tab', tab)
    }
    const qs = params.toString()
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false })
  }

  const counterpartyHint = searchParams.get('counterparty') ?? null
  const clearCounterpartyFilter = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('counterparty')
    const qs = params.toString()
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false })
  }

  const workspaceBase = pathname.replace(/\/blotter$/, '/workspace')
  const csaBase = pathname.replace(/\/blotter$/, '/csa')

  return {
    activeTab,
    handleTabChange,
    counterpartyHint,
    clearCounterpartyFilter,
    workspaceBase,
    csaBase,
  }
}
