'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useLedgerClient } from '@/shared/hooks/use-ledger-client'
import type { ContractResult } from '@/shared/ledger/types'
import type { LedgerActivityEvent } from '../types'
import { partyFromPayload } from '../utils'

interface Options {
  templateIds: readonly string[]
  enabled: boolean
  push: (event: LedgerActivityEvent) => void
}

const REFETCH_MS = 5_000
const SEED_CONCURRENCY = 8

// HTTP-poll seed for the activity buffer. Canton's WS /v1/stream/query for
// readAs-only JWTs (regulator demo profile) ships the active set empty in
// some setups even when /v1/query for the same templates returns rows.
// Polling /v1/query on a loop and pushing each contract as a synthetic
// create event keeps the buffer's dedup-on-(kind,cid) honest while making
// the regulator's ledger explorer useful immediately. WS still wins for
// incremental events when it works.
//
// Implemented with plain setInterval rather than @tanstack/react-query so
// the hook doesn't require a QueryClientProvider — the provider that
// hosts this seed is mounted in tests that don't pull in the app-level
// providers tree.
export function useLedgerActivityHttpSeed({ templateIds, enabled, push }: Options): void {
  const { client } = useLedgerClient()
  const templatesKey = templateIds.join('|')
  const idsForQuery = useMemo(() => [...templateIds], [templatesKey])
  // Pin push in a ref so the polling effect doesn't tear down + restart on
  // every provider re-render — buffer push identity is stable but TS can't
  // prove it across the provider boundary.
  const pushRef = useRef(push)
  pushRef.current = push

  useEffect(() => {
    if (!enabled || !client || idsForQuery.length === 0) return
    let cancelled = false

    const tick = async () => {
      const rows: Array<{ templateId: string; contractId: string; payload: unknown }> = []
      for (let i = 0; i < idsForQuery.length; i += SEED_CONCURRENCY) {
        const slice = idsForQuery.slice(i, i + SEED_CONCURRENCY)
        const results = await Promise.allSettled(
          slice.map((tid) =>
            client
              .query<ContractResult<unknown>>(tid)
              .then((rs) =>
                rs.map((r) => ({ templateId: tid, contractId: r.contractId, payload: r.payload })),
              ),
          ),
        )
        for (const r of results) if (r.status === 'fulfilled') rows.push(...r.value)
      }
      if (cancelled) return
      const now = Date.now()
      for (const row of rows) {
        pushRef.current({
          kind: 'create',
          templateId: row.templateId,
          contractId: row.contractId,
          party: partyFromPayload(row.payload),
          ts: now,
          payload: row.payload,
        })
      }
    }

    void tick()
    const id = setInterval(() => void tick(), REFETCH_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [enabled, client, idsForQuery])
}
