// TS mirror of the Daml helpers in Csa/Csa.daml. Stage B's reproducibility
// test (Stage D) relies on bit-for-bit equivalence between these and the
// on-chain gateCall/computeRequired — if Daml math changes, bump here too.

export interface RequiredPair {
  fromA: number
  fromB: number
}

export function computeRequired(
  exposure: number,
  thresholdDirA: number,
  thresholdDirB: number,
): RequiredPair {
  return {
    fromA: Math.max(0, exposure - thresholdDirB),
    fromB: Math.max(0, -exposure - thresholdDirA),
  }
}

export function gateCall(raw: number, mta: number, rounding: number): number {
  if (Math.abs(raw) < mta) return 0
  if (rounding === 0) return raw
  const n = Math.round(raw / rounding)
  return n * rounding
}
