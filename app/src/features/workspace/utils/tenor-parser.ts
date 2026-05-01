export interface Tenor {
  years: number
  months: number
}

export function parseTenor(input: string): Tenor | null {
  const s = input.trim().toUpperCase()
  if (!s) return null

  const combined = s.match(/^(\d+)Y(\d+)M$/)
  if (combined) {
    return { years: parseInt(combined[1], 10), months: parseInt(combined[2], 10) }
  }

  const yearsOnly = s.match(/^(\d+)Y$/)
  if (yearsOnly) {
    return { years: parseInt(yearsOnly[1], 10), months: 0 }
  }

  const monthsOnly = s.match(/^(\d+)M$/)
  if (monthsOnly) {
    return { years: 0, months: parseInt(monthsOnly[1], 10) }
  }

  return null
}

export function formatTenor(tenor: Tenor): string {
  if (tenor.years > 0 && tenor.months > 0) return `${tenor.years}Y${tenor.months}M`
  if (tenor.years > 0) return `${tenor.years}Y`
  return `${tenor.months}M`
}

export function addTenor(date: Date, tenor: Tenor): Date {
  const result = new Date(date)
  result.setFullYear(result.getFullYear() + tenor.years)
  result.setMonth(result.getMonth() + tenor.months)
  return result
}

export function computeTenor(start: Date, end: Date): Tenor {
  let years = end.getFullYear() - start.getFullYear()
  let months = end.getMonth() - start.getMonth()
  const days = end.getDate() - start.getDate()

  if (days < 0) months -= 1
  if (months < 0) {
    years -= 1
    months += 12
  }

  return { years, months }
}
