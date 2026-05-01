'use client'

import type { CsaViewModel } from '../decode'
import { useCsas } from './use-csas'

export function useCsaForPair(partyA: string, partyB: string): CsaViewModel | null {
  const { data } = useCsas()
  return data.find((c) => pairMatches(c, partyA, partyB)) ?? null
}

function pairMatches(c: CsaViewModel, a: string, b: string): boolean {
  const aLower = a.toLowerCase()
  const bLower = b.toLowerCase()
  const partyALower = c.partyA.toLowerCase()
  const partyBLower = c.partyB.toLowerCase()
  return (
    (partyALower.includes(aLower) && partyBLower.includes(bLower)) ||
    (partyALower.includes(bLower) && partyBLower.includes(aLower))
  )
}
