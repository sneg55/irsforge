export const PARTIES = {
  OPERATOR: { id: 'operator', displayName: 'Operator', hint: 'Operator' },
  PARTY_A: { id: 'partyA', displayName: 'Goldman Sachs', hint: 'PartyA' },
  PARTY_B: { id: 'partyB', displayName: 'JPMorgan', hint: 'PartyB' },
  REGULATOR: { id: 'regulator', displayName: 'Regulator', hint: 'Regulator' },
} as const

export type PartyId = keyof typeof PARTIES
