export type LedgerActivityKind = 'create' | 'archive' | 'exercise'

export interface LedgerActivityEvent {
  kind: LedgerActivityKind
  templateId: string
  contractId: string
  party: string | null
  ts: number
  choice?: string
  resultCid?: string
  payload?: unknown
}

export interface LedgerActivityFilter {
  kinds?: LedgerActivityKind[]
  templateAllow?: string[]
  templateDeny?: string[]
  // Prefixes treated as "system-generated" (scheduler/oracle/mark chatter).
  // Honoured only when `includeSystem` is not true — create/archive events
  // matching any of these are filtered out. Exercise events are always kept
  // because the bus only fires on LedgerClient.exercise, which is always a
  // user action in this architecture.
  systemPrefixes?: readonly string[]
  includeSystem?: boolean
  cidPrefix?: string
}
