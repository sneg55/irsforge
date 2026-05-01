import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// RTL does not auto-cleanup under vitest unless `globals: true`; wire it explicitly.
afterEach(() => {
  cleanup()
})

// vitest's jsdom environment ships with a stub `window.localStorage` that has
// no setItem / getItem / removeItem. Real browsers implement the full Web
// Storage API. Install an in-memory replacement so code exercising localStorage
// runs under test with the same contract as production.

if (typeof window !== 'undefined' && typeof window.localStorage?.setItem !== 'function') {
  const store = new Map<string, string>()
  const storage: Storage = {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key) {
      return store.has(key) ? store.get(key)! : null
    },
    key(i) {
      return Array.from(store.keys())[i] ?? null
    },
    removeItem(key) {
      store.delete(key)
    },
    setItem(key, value) {
      store.set(key, String(value))
    },
  }
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true })
}
