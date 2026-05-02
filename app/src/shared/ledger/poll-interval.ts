// Shared `refetchInterval` helper for React Query.
//
// Returns a function that React Query calls per query, evaluated against
// the live `Query` object. While the query is in error state, polling
// drops to `backoffMs` (default 30 s); on first success it snaps back to
// `healthyMs`. Without this, a Canton-down window leaves every poll
// firing through its retry chain at the original cadence (e.g. 3 s) and
// the page re-renders constantly while no new data is possible.
//
// Usage:
//
//   refetchInterval: pollIntervalWithBackoff(3_000)
//   refetchInterval: pollIntervalWithBackoff(5_000, 60_000)
//
// `Query` is the React Query observer object — we only need
// `state.error`, so the local interface keeps the helper free of a
// transitive @tanstack/react-query type dependency.
export const DEFAULT_BACKOFF_MS = 30_000

interface QueryWithError {
  readonly state: { readonly error: unknown }
}

export function pollIntervalWithBackoff(
  healthyMs: number,
  backoffMs: number = DEFAULT_BACKOFF_MS,
): (query: QueryWithError) => number {
  return (query) => (query.state.error ? backoffMs : healthyMs)
}
