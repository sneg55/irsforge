export interface NYFedSofrResponse {
  refRates: Array<{
    effectiveDate: string
    type: string
    percentRate: number
    volumeInBillions: number
  }>
}

export interface NYFedAllRatesResponse {
  refRates: Array<{
    effectiveDate: string
    type: string
    percentRate?: number
    index?: number
    average30Day?: number
    average90Day?: number
    average180Day?: number
  }>
}

export interface CurvePoint {
  rateId: string
  tenorDays: number
  rate: number
}
