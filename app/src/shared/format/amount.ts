// Single source of truth for compact monetary amount formatting across
// blotter rows, regulator oversight, workspace tiles, and operator
// surfaces. Before audit E3 the codebase had three local impls — full
// `$10,000,000`, raw `10M`, and `10.0M USD` — and a reader switching
// roles read the same number three different ways. Pick one shape and
// reuse: `$10M` for USD, `€10M` for EUR, `10M USD` as the fallback for
// currencies without a Unicode symbol.

const SYMBOL: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
}

function stripTrailingZero(s: string): string {
  return s.endsWith('.0') ? s.slice(0, -2) : s
}

function compactMagnitude(abs: number): string {
  if (abs === 0) return '0'
  if (abs >= 1_000_000_000) return `${stripTrailingZero((abs / 1_000_000_000).toFixed(1))}B`
  if (abs >= 1_000_000) return `${stripTrailingZero((abs / 1_000_000).toFixed(1))}M`
  if (abs >= 1_000) return `${stripTrailingZero((abs / 1_000).toFixed(1))}K`
  return `${Math.round(abs)}`
}

/**
 * Compact currency amount. Defaults to USD when `ccy` is omitted, which
 * matches the pre-E3 behaviour of the blotter helpers.
 *
 * Examples:
 *   formatCompactAmount(10_000_000) → "$10M"
 *   formatCompactAmount(-8_640_000) → "-$8.6M"
 *   formatCompactAmount(10_000_000, 'EUR') → "€10M"
 *   formatCompactAmount(10_000_000, 'CHF') → "10M CHF"
 */
export function formatCompactAmount(n: number, ccy: string = 'USD'): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  const magnitude = compactMagnitude(abs)
  const symbol = SYMBOL[ccy]
  if (symbol) return `${sign}${symbol}${magnitude}`
  return `${sign}${magnitude} ${ccy}`
}
