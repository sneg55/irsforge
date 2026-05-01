import type { AuthMeta } from './auth-types'

// Legacy key (full state inc. accessToken) — kept only so we can purge any
// blob a previous client wrote. Never read or written as authoritative.
const LEGACY_AUTH_STORAGE_KEY = 'irsforge:auth'

// Only non-secret identity is persisted here. The access token and its expiry
// are intentionally NOT stored, to keep the JWT out of any JS-readable
// surface (XSS, supply-chain). On reload we recover a fresh access token via
// the HttpOnly refresh cookie at /auth/refresh.
const AUTH_META_STORAGE_KEY = 'irsforge:auth-meta'

export function loadStoredAuthMeta(): AuthMeta | null {
  if (typeof window === 'undefined') return null
  // Drop any legacy blob (which may have contained a JWT) on first load.
  try {
    window.localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY)
  } catch {
    // ignore — storage may be unavailable (private mode / quota)
  }
  try {
    const raw = window.localStorage.getItem(AUTH_META_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AuthMeta
    if (
      typeof parsed?.userId !== 'string' ||
      typeof parsed?.orgId !== 'string' ||
      typeof parsed?.party !== 'string'
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function writeAuthMeta(meta: AuthMeta | null): void {
  if (typeof window === 'undefined') return
  try {
    if (meta) {
      window.localStorage.setItem(AUTH_META_STORAGE_KEY, JSON.stringify(meta))
    } else {
      window.localStorage.removeItem(AUTH_META_STORAGE_KEY)
    }
  } catch {
    // ignore
  }
}
