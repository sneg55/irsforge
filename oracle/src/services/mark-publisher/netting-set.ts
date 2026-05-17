import type { SwapWorkflow } from '../../shared/types.js'

export interface NettingSetEntry {
  csaCid: string
  partyA: string
  partyB: string
  /**
   * Per-swap orientation flag. `reversed === true` when the workflow was
   * proposed by csa.partyB → csa.partyA (i.e. swap.partyA equals
   * csa.partyB). The mark computer must flip the swap's PV sign so the
   * netted exposure stays in csa.partyA's frame of reference, mirroring
   * the on-chain Daml `NettedSettlement.netAcrossSwaps` logic.
   */
  swaps: Array<{ contractId: string; payload: SwapWorkflow; reversed: boolean }>
}

export function groupByNettingSet(
  csas: Array<{ contractId: string; payload: { partyA: string; partyB: string } }>,
  workflows: Array<{ contractId: string; payload: SwapWorkflow }>,
): NettingSetEntry[] {
  return csas.map((c) => ({
    csaCid: c.contractId,
    partyA: c.payload.partyA,
    partyB: c.payload.partyB,
    swaps: workflows
      .filter((w) => pairMatches(w.payload, c.payload.partyA, c.payload.partyB))
      .map((w) => ({
        contractId: w.contractId,
        payload: w.payload,
        reversed: w.payload.partyA !== c.payload.partyA,
      })),
  }))
}

function pairMatches(w: SwapWorkflow, a: string, b: string): boolean {
  return (w.partyA === a && w.partyB === b) || (w.partyA === b && w.partyB === a)
}
