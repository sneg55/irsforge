import type { NYFedAllRatesResponse } from './types.js'

export function validateSofrResponse(data: NYFedAllRatesResponse, expectedDate: string): void {
  if (!data.refRates || data.refRates.length === 0) {
    throw new Error(`No SOFR data returned for date ${expectedDate}`)
  }
  const sofrEntry = data.refRates.find((r) => r.type === 'SOFR')
  if (!sofrEntry) {
    throw new Error(`No SOFR entry found in response for ${expectedDate}`)
  }
  if (sofrEntry.effectiveDate !== expectedDate) {
    throw new Error(`Date mismatch: expected ${expectedDate}, got ${sofrEntry.effectiveDate}`)
  }
}

export function extractSofrIndex(data: NYFedAllRatesResponse): number {
  // NY Fed publishes the SOFR Averages & Index under type "SOFRAI" (the
  // cumulative compounded index). The "SOFR INDEX" label appears only in
  // older documentation; the live API at markets.newyorkfed.org/api/rates/
  // secured/sofrai/search.json returns type="SOFRAI".
  const indexEntry = data.refRates.find((r) => r.type === 'SOFRAI')
  if (!indexEntry?.index) {
    throw new Error('SOFR Index value not found in response')
  }
  return indexEntry.index
}

export function extractSofrOvernight(data: NYFedAllRatesResponse): number {
  const sofrEntry = data.refRates.find((r) => r.type === 'SOFR')
  if (typeof sofrEntry?.percentRate !== 'number') {
    throw new Error('SOFR overnight percentRate not found in response')
  }
  return sofrEntry.percentRate
}
