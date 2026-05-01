export type StreamStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'fallback'
export type StreamPhase = 'initial' | 'live' | 'reconnecting' | 'disconnected'

export function streamPhase(status: StreamStatus, hasData: boolean): StreamPhase {
  if (status === 'fallback') return 'disconnected'
  if (status === 'open') return 'live'
  if (hasData) return 'reconnecting'
  return 'initial'
}

export function phaseToLiveness(phase: StreamPhase): 'live' | 'stale' | 'disconnected' | 'idle' {
  if (phase === 'live') return 'live'
  if (phase === 'reconnecting') return 'stale'
  if (phase === 'disconnected') return 'disconnected'
  return 'idle'
}
