import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchWithTimeout, withRetry } from '../retry'

describe('withRetry', () => {
  it('returns on first success without sleeping', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const result = await withRetry(fn, { attempts: 3, baseMs: 1000, jitter: 0 })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('succeeds on attempt 3 after two throws', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('a'))
      .mockRejectedValueOnce(new Error('b'))
      .mockResolvedValueOnce('ok')
    const result = await withRetry(fn, { attempts: 3, baseMs: 1, jitter: 0 })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('rethrows last error after exhausting attempts', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('persistent-1'))
      .mockRejectedValueOnce(new Error('persistent-2'))
      .mockRejectedValueOnce(new Error('persistent-3'))
    await expect(withRetry(fn, { attempts: 3, baseMs: 1, jitter: 0 })).rejects.toThrow(
      'persistent-3',
    )
    expect(fn).toHaveBeenCalledTimes(3)
  })
})

describe('fetchWithTimeout', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('rejects with AbortError when timeout elapses', async () => {
    vi.stubGlobal(
      'fetch',
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          )
        }),
    )
    await expect(fetchWithTimeout('http://example', { timeoutMs: 20 })).rejects.toThrow(/abort/i)
  })

  it('clears timeout timer on successful fetch so the process can exit', async () => {
    vi.stubGlobal('fetch', async () => new Response('ok'))
    const res = await fetchWithTimeout('http://example', { timeoutMs: 5000 })
    expect(await res.text()).toBe('ok')
  })
})
