// A local exercise event — what LedgerClient.exercise reports to any
// subscriber after a successful /v1/exercise call. This is the only
// "EXERCISE" signal the UI has without a server-side gRPC tap; cross-user
// exercises surface as archive + create pairs from /v1/stream/query instead.
export interface LocalExerciseEvent {
  templateId: string
  contractId: string
  choice: string
  actAs: readonly string[]
  resultCid?: string
  ts: number
}

type Listener = (event: LocalExerciseEvent) => void

class LedgerActivityBus {
  private readonly listeners = new Set<Listener>()

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  emit(event: LocalExerciseEvent): void {
    // Snapshot before dispatch so subscribe/unsubscribe from inside a listener
    // cannot affect the in-flight event. Without this, a listener that subscribes
    // during emit would be visited in the same iteration — almost never wanted.
    const snapshot = Array.from(this.listeners)
    for (const l of snapshot) {
      try {
        l(event)
      } catch {
        // One subscriber throwing must not block the others. The bus is a
        // best-effort signal, not a reliability primitive — silently swallow.
        // silent-ok
      }
    }
  }
}

export const ledgerActivityBus = new LedgerActivityBus()
