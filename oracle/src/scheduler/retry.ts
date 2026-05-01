export interface RetryOpts {
  attempts: number
  baseMs: number
  /** 0 = no jitter; 0.2 = ±20% around the computed backoff. */
  jitter: number
}

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOpts): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < opts.attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (i === opts.attempts - 1) break
      const backoff = opts.baseMs * Math.pow(2, i)
      const jittered = backoff * (1 + (Math.random() * 2 - 1) * opts.jitter)
      await new Promise((r) => setTimeout(r, jittered))
    }
  }
  throw lastErr
}

export interface FetchTimeoutOpts extends RequestInit {
  timeoutMs: number
}

export function fetchWithTimeout(url: string, opts: FetchTimeoutOpts): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs)
  const { timeoutMs: _timeoutMs, ...rest } = opts
  return fetch(url, { ...rest, signal: controller.signal }).finally(() => clearTimeout(timer))
}
