export class OracleUnavailableError extends Error {
  constructor(message = 'Oracle rates unavailable') {
    super(message)
    this.name = 'OracleUnavailableError'
  }
}

export type CurveSource = 'ledger' | 'oracle' | 'unavailable'
