export interface SnapshotInput {
  curveCids: string[]
  indexCids: string[]
  observationCutoff: string
  swapCids: string[]
  // Phase 6 additions — present only when a CSA's swap families demand them.
  // Sorted into the JSON output when present so the snapshot string stays
  // stable (deterministic hashing — same inputs produce byte-identical
  // snapshots regardless of contract-id discovery order).
  bookCurveCids?: string[]
  fxSpotCids?: string[]
  cdsCurveCids?: string[]
}

export function buildSnapshot(s: SnapshotInput): string {
  const out: Record<string, unknown> = {
    curveCids: [...s.curveCids].sort(),
    indexCids: [...s.indexCids].sort(),
    observationCutoff: s.observationCutoff,
    swapCids: [...s.swapCids].sort(),
  }
  if (s.bookCurveCids?.length) out.bookCurveCids = [...s.bookCurveCids].sort()
  if (s.fxSpotCids?.length) out.fxSpotCids = [...s.fxSpotCids].sort()
  if (s.cdsCurveCids?.length) out.cdsCurveCids = [...s.cdsCurveCids].sort()
  return JSON.stringify(out)
}
