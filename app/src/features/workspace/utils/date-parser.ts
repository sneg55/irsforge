const MONTH_NAMES: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
}

function expandYear(y: number): number {
  return y < 100 ? (y < 50 ? 2000 + y : 1900 + y) : y
}

function isValidDate(d: Date): boolean {
  return d instanceof Date && !isNaN(d.getTime())
}

export function parseDate(input: string, relativeTo?: Date): Date | null {
  const s = input.trim()
  if (!s) return null

  // 5. Relative dates: +5d, -3m, +1y, 2m (check first to avoid false matches)
  const relMatch = s.match(/^([+-]?)(\d+)([dmy])$/i)
  if (relMatch) {
    const base = relativeTo ?? new Date()
    const sign = relMatch[1] === '-' ? -1 : 1
    const amount = parseInt(relMatch[2], 10) * sign
    const unit = relMatch[3].toLowerCase()
    const result = new Date(base)
    if (unit === 'd') result.setDate(result.getDate() + amount)
    else if (unit === 'm') result.setMonth(result.getMonth() + amount)
    else if (unit === 'y') result.setFullYear(result.getFullYear() + amount)
    return isValidDate(result) ? result : null
  }

  // 1. MM/DD/YY or MM/DD/YYYY
  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (slashMatch) {
    const m = parseInt(slashMatch[1], 10) - 1
    const d = parseInt(slashMatch[2], 10)
    const y = expandYear(parseInt(slashMatch[3], 10))
    const date = new Date(y, m, d)
    if (date.getMonth() === m && date.getDate() === d) return date
    return null
  }

  // 2. MMDDYY or MMDDYYYY (6 or 8 digits, no separators)
  if (/^\d{6}$/.test(s)) {
    const m = parseInt(s.slice(0, 2), 10) - 1
    const d = parseInt(s.slice(2, 4), 10)
    const y = expandYear(parseInt(s.slice(4, 6), 10))
    const date = new Date(y, m, d)
    if (date.getMonth() === m && date.getDate() === d) return date
    return null
  }
  if (/^\d{8}$/.test(s)) {
    const m = parseInt(s.slice(0, 2), 10) - 1
    const d = parseInt(s.slice(2, 4), 10)
    const y = parseInt(s.slice(4, 8), 10)
    const date = new Date(y, m, d)
    if (date.getMonth() === m && date.getDate() === d) return date
    return null
  }

  // 3. "Jun 15 2026" or "Jun 15 26"
  const nameMatch = s.match(/^([a-z]{3})\s+(\d{1,2})\s+(\d{2,4})$/i)
  if (nameMatch) {
    const monthNum = MONTH_NAMES[nameMatch[1].toLowerCase()]
    if (monthNum === undefined) return null
    const d = parseInt(nameMatch[2], 10)
    const y = expandYear(parseInt(nameMatch[3], 10))
    const date = new Date(y, monthNum, d)
    if (date.getMonth() === monthNum && date.getDate() === d) return date
    return null
  }

  // 4. YYYY-MM-DD (ISO)
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10)
    const m = parseInt(isoMatch[2], 10) - 1
    const d = parseInt(isoMatch[3], 10)
    const date = new Date(y, m, d)
    if (date.getMonth() === m && date.getDate() === d) return date
    return null
  }

  return null
}
