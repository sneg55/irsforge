// Pure heuristics + coercion helpers used by the payload-summary renderers.
// Kept regex-free so the security ESLint plugin doesn't flag unsafe patterns.

export function looksLikeParty(v: string): boolean {
  if (typeof v !== 'string') return false
  const idx = v.indexOf('::')
  if (idx <= 0) return false
  return v.length - idx > 6
}

export function looksLikeContractId(v: string): boolean {
  if (typeof v !== 'string' || v.length < 42 || v.length > 256) return false
  if (!v.startsWith('00')) return false
  for (let i = 2; i < v.length; i++) {
    const c = v.charCodeAt(i)
    const isDigit = c >= 48 && c <= 57
    const isHexLower = c >= 97 && c <= 102
    if (!(isDigit || isHexLower)) return false
  }
  return true
}

export function looksLikeIsoDate(v: string): boolean {
  if (typeof v !== 'string' || v.length < 10) return false
  // YYYY-MM-DD prefix; optional T HH:MM:SS suffix is allowed but not required.
  return (
    isAsciiDigit(v, 0) &&
    isAsciiDigit(v, 1) &&
    isAsciiDigit(v, 2) &&
    isAsciiDigit(v, 3) &&
    v[4] === '-' &&
    isAsciiDigit(v, 5) &&
    isAsciiDigit(v, 6) &&
    v[7] === '-' &&
    isAsciiDigit(v, 8) &&
    isAsciiDigit(v, 9)
  )
}

function isAsciiDigit(s: string, i: number): boolean {
  const c = s.charCodeAt(i)
  return c >= 48 && c <= 57
}

export function looksLikeDecimal(v: string): boolean {
  if (typeof v !== 'string' || v.length === 0 || v.length >= 30) return false
  let i = 0
  if (v[0] === '-') i = 1
  if (i >= v.length) return false
  let sawDigit = false
  let sawDot = false
  for (; i < v.length; i++) {
    if (isAsciiDigit(v, i)) {
      sawDigit = true
      continue
    }
    if (v[i] === '.' && !sawDot) {
      sawDot = true
      continue
    }
    return false
  }
  return sawDigit
}

export function isCcyMap(v: unknown): v is [string, string][] {
  if (!Array.isArray(v) || v.length === 0) return false
  return v.every(
    (row) =>
      Array.isArray(row) &&
      row.length === 2 &&
      typeof row[0] === 'string' &&
      row[0].length <= 6 &&
      typeof row[1] === 'string' &&
      looksLikeDecimal(row[1]),
  )
}

export function isInstrumentKey(o: Record<string, unknown>): boolean {
  return 'depository' in o && 'issuer' in o && 'id' in o && 'version' in o
}

export function humanizeKey(key: string): string {
  // partyA → Party A; isdaMasterAgreementRef → Isda Master Agreement Ref
  const out: string[] = []
  for (let i = 0; i < key.length; i++) {
    const ch = key[i]
    const code = key.charCodeAt(i)
    const isUpper = code >= 65 && code <= 90
    if (i === 0) {
      out.push(isUpper ? ch : ch.toUpperCase())
    } else if (isUpper) {
      out.push(' ', ch)
    } else {
      out.push(ch)
    }
  }
  return out.join('').trim()
}

export function str(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v)
}

export function arr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}
