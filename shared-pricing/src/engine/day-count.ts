import type { DayCountConvention } from './types.js'

const MS_PER_DAY = 86400000
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / MS_PER_DAY)

export function yearFraction(start: Date, end: Date, convention: DayCountConvention): number {
  switch (convention) {
    case 'ACT_360':
      return daysBetween(start, end) / 360
    case 'ACT_365':
      return daysBetween(start, end) / 365
    case 'THIRTY_360': {
      const d1 = Math.min(start.getDate(), 30)
      const d2 = Math.min(end.getDate(), 30)
      return (
        ((end.getFullYear() - start.getFullYear()) * 360 +
          (end.getMonth() - start.getMonth()) * 30 +
          (d2 - d1)) /
        360
      )
    }
    case 'THIRTY_E_360': {
      const d1 = Math.min(start.getDate(), 30)
      const d2 = Math.min(end.getDate(), 30)
      return (
        ((end.getFullYear() - start.getFullYear()) * 360 +
          (end.getMonth() - start.getMonth()) * 30 +
          (d2 - d1)) /
        360
      )
    }
  }
}
