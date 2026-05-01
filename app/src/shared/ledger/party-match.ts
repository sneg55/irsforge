// Strict-equality helpers for matching Canton parties against a known hint.
//
// Background. Daml `Party` values arrive as `Hint::fingerprint` strings.
// The legacy pattern across the app was
// `fullParty.toLowerCase().includes(hint.toLowerCase())` — readable but
// fragile because it accepts any party whose hint *contains* the active
// hint as a substring. A future participant named e.g. `PartyAlpha` would
// silently match every check intended for `Party`.
//
// `hintFromParty` and `partyMatchesHint` are the strict alternative: split
// both inputs on `::` and compare the pre-fingerprint segment exactly.
// Either argument can be the bare hint (`PartyA`) or the full party id
// (`PartyA::abc`); the helper normalises before comparing.

export function hintFromParty(fullParty: string): string {
  return fullParty.split('::')[0] ?? fullParty
}

export function partyMatchesHint(party: string, hintOrParty: string): boolean {
  return hintFromParty(party) === hintFromParty(hintOrParty)
}
