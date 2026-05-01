import { describe, expect, it } from 'vitest'
import { hintFromParty, partyMatchesHint } from '../party-match'

describe('hintFromParty', () => {
  it('returns hint segment for full party id', () => {
    expect(hintFromParty('PartyA::1220abc')).toBe('PartyA')
    expect(hintFromParty('Operator::xyz')).toBe('Operator')
  })

  it('returns input as-is when bare hint with no `::`', () => {
    expect(hintFromParty('PartyA')).toBe('PartyA')
    expect(hintFromParty('Operator')).toBe('Operator')
  })

  it('handles empty input safely', () => {
    expect(hintFromParty('')).toBe('')
  })
})

describe('partyMatchesHint', () => {
  it('matches full party id against bare hint', () => {
    expect(partyMatchesHint('PartyA::1220abc', 'PartyA')).toBe(true)
    expect(partyMatchesHint('PartyA::1220abc', 'PartyB')).toBe(false)
  })

  it('matches bare hint against bare hint', () => {
    expect(partyMatchesHint('PartyA', 'PartyA')).toBe(true)
    expect(partyMatchesHint('PartyA', 'PartyB')).toBe(false)
  })

  it('matches full party id against full party id by hint segment', () => {
    expect(partyMatchesHint('PartyA::1220abc', 'PartyA::differentfingerprint')).toBe(true)
    expect(partyMatchesHint('PartyA::1220abc', 'PartyB::1220abc')).toBe(false)
  })

  it('rejects substring-only matches that the legacy pattern would have accepted', () => {
    // The whole point of the strict helper: PartyAlpha must NOT match Party.
    expect(partyMatchesHint('PartyAlpha::ns', 'Party')).toBe(false)
    expect(partyMatchesHint('OperatorAdmin::ns', 'Operator')).toBe(false)
    // And case mismatches don't slide through either.
    expect(partyMatchesHint('PartyA::ns', 'partya')).toBe(false)
  })
})
