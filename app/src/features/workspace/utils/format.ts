// Notional, cashflow amounts, PV, Net Valuation: 0 decimals, comma-separated
export function formatAmount(n: number): string {
  const prefix = n >= 0 ? '+' : ''
  return prefix + Math.round(n).toLocaleString('en-US')
}

// Fixed Rate: exactly 4 decimals with % suffix
export function formatFixedRate(rate: number): string {
  return `${(rate * 100).toFixed(4)} %`
}

// Floating/projected rates: 3 decimals with % suffix
export function formatFloatRate(rate: number): string {
  return `${(rate * 100).toFixed(3)} %`
}

// Spread in basis points: integer
export function formatSpread(spread: number): string {
  return `${Math.round(spread * 10000)} bp`
}

// Discount factor: 4 decimals
export function formatDF(df: number): string {
  return df.toFixed(4)
}

// Notional display: no decimals, comma separated, no $ prefix
export function formatNotional(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}

// Parse user input: handles commas, M/B suffixes, scientific notation
export function parseNumericInput(raw: string): number | null {
  let cleaned = raw.replace(/,/g, '').replace(/\s/g, '').trim()
  // Handle M/B suffixes
  // eslint-disable-next-line security/detect-unsafe-regex -- linear anchored numeric pattern, single optional decimal group
  if (/^\d+(\.\d+)?[mM]$/.test(cleaned)) {
    return parseFloat(cleaned) * 1_000_000
  }
  // eslint-disable-next-line security/detect-unsafe-regex -- linear anchored numeric pattern, single optional decimal group
  if (/^\d+(\.\d+)?[bB]$/.test(cleaned)) {
    return parseFloat(cleaned) * 1_000_000_000
  }
  // Handle % suffix (strip it)
  cleaned = cleaned.replace(/%$/, '')
  // Handle bp suffix
  cleaned = cleaned.replace(/bp$/i, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

// Color class for a value
export function valueColorClass(n: number): string {
  return n >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'
}

// Sign prefix
export function signPrefix(n: number): string {
  return n >= 0 ? '+' : ''
}
