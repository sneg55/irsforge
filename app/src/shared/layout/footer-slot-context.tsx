'use client'

import type { DiscountCurve, SwapConfig, ValuationResult } from '@irsforge/shared-pricing'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'

export interface FooterSlotData {
  valuation: ValuationResult | null
  swapConfig: SwapConfig | null
  curve: DiscountCurve | null
}

// Split into two contexts so writers don't subscribe to value changes.
// Single-context design caused: setSlot → context ref changes → writer re-renders →
// recomputes valuation (new ref) → effect re-fires → setSlot → loop.
const FooterSlotValueContext = createContext<FooterSlotData | null>(null)
const FooterSlotSetterContext = createContext<((v: FooterSlotData | null) => void) | null>(null)

export function FooterSlotProvider({ children }: { children: ReactNode }) {
  const [slot, setSlotState] = useState<FooterSlotData | null>(null)
  const setSlot = useCallback((v: FooterSlotData | null) => setSlotState(v), [])
  return (
    <FooterSlotSetterContext.Provider value={setSlot}>
      <FooterSlotValueContext.Provider value={slot}>{children}</FooterSlotValueContext.Provider>
    </FooterSlotSetterContext.Provider>
  )
}

export function useFooterSlot(): FooterSlotData | null {
  return useContext(FooterSlotValueContext)
}

export function useSetFooterSlot(data: FooterSlotData): void {
  const setSlot = useContext(FooterSlotSetterContext)
  const { valuation, swapConfig, curve } = data
  const dataRef = useRef(data)
  dataRef.current = data
  useEffect(() => {
    if (!setSlot) return
    setSlot(dataRef.current)
    return () => setSlot(null)
  }, [setSlot, valuation, swapConfig, curve])
}
