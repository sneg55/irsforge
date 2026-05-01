import type { SwapWorkflow } from '../../shared/types.js'

export interface NettingSetEntry {
  csaCid: string
  partyA: string
  partyB: string
  swaps: Array<{ contractId: string; payload: SwapWorkflow }>
}

export function groupByNettingSet(
  csas: Array<{ contractId: string; payload: { partyA: string; partyB: string } }>,
  workflows: Array<{ contractId: string; payload: SwapWorkflow }>,
): NettingSetEntry[] {
  return csas.map((c) => ({
    csaCid: c.contractId,
    partyA: c.payload.partyA,
    partyB: c.payload.partyB,
    swaps: workflows.filter((w) => pairMatches(w.payload, c.payload.partyA, c.payload.partyB)),
  }))
}

function pairMatches(w: SwapWorkflow, a: string, b: string): boolean {
  return (w.partyA === a && w.partyB === b) || (w.partyA === b && w.partyB === a)
}
