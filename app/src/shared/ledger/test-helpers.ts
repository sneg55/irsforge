import { vi } from 'vitest'

export const NAMESPACE = '1220abcdef'
export const PARTY_A_FULL = `PartyA::${NAMESPACE}`
export const PARTY_B_FULL = `PartyB::${NAMESPACE}`

/** Build a fake JWT with given claims (base64 only, no crypto) */
export function fakeJwt(claims: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256' }))
  const payload = btoa(JSON.stringify(claims))
  return `${header}.${payload}.fake-sig`
}

export function makeDamlJwt(actAs: string[], readAs: string[] = []) {
  return fakeJwt({
    'https://daml.com/ledger-api': {
      ledgerId: 'sandbox',
      applicationId: 'IRSForge',
      actAs,
      readAs,
    },
  })
}

/** Mock fetch and return the mock function. Call in beforeEach. */
export function mockFetch() {
  const mock = vi.fn()
  vi.stubGlobal('fetch', mock)
  return mock
}

/** Shorthand for a successful JSON response */
export function okJson(data: unknown) {
  return { ok: true, json: () => Promise.resolve(data) }
}

/** Shorthand for a failed text response */
export function failText(text: string, status = 400) {
  return { ok: false, status, text: () => Promise.resolve(text) }
}
