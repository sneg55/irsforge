'use client'

import { useMemo } from 'react'
import { useLedgerActivityContext } from '@/features/ledger/contexts/ledger-activity-provider'
import type { BusinessEvent } from '../timeline/business-events'
import { decode } from '../timeline/decode'

export interface UseBusinessEventsResult {
  events: BusinessEvent[]
  phase: ReturnType<typeof useLedgerActivityContext>['phase']
}

/**
 * Pipes the raw LedgerActivityProvider buffer through the regulator
 * decoder, dropping events that don't map to a BusinessEvent narrative.
 * Memoised on the buffer reference so the decoder runs only when new
 * events arrive.
 */
export function useBusinessEvents(): UseBusinessEventsResult {
  const ctx = useLedgerActivityContext()
  const events = useMemo<BusinessEvent[]>(() => {
    const out: BusinessEvent[] = []
    for (const raw of ctx.events) {
      const decoded = decode(raw)
      if (decoded) out.push(decoded)
    }
    return out
  }, [ctx.events])
  return { events, phase: ctx.phase }
}
