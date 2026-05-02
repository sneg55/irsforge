'use client'

import { useQueries } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useLedger } from '@/shared/contexts/ledger-context'
import { pollIntervalWithBackoff } from '@/shared/ledger/poll-interval'
import { buildBootstrapResult } from './bootstrap-status-builders'
import {
  BOOTSTRAP_QUERY_KEYS,
  BOOTSTRAP_TEMPLATE_BY_KEY,
  type BootstrapQueryKey,
} from './bootstrap-status-templates'
import type { UseBootstrapStatusResult } from './bootstrap-status-types'

export type {
  BootstrapRow,
  BootstrapSection,
  UseBootstrapStatusResult,
} from './bootstrap-status-types'

// One useQuery per operator-signed bootstrap template (see
// contracts/src/Setup/InitImpl.daml). Returned rows are derived from
// payload data — calendar count from the HolidayCalendar query, manual-
// vs-scheduler split from the LifecycleRule.id.unpack field. View layer
// renders sections without re-doing this work.

export function useBootstrapStatus(): UseBootstrapStatusResult {
  const { client } = useLedger()

  const queries = useQueries({
    queries: BOOTSTRAP_QUERY_KEYS.map((key) => ({
      queryKey: ['bootstrap-status', key] as const,
      queryFn: () =>
        client!.query<{ contractId: string; payload: unknown }>(BOOTSTRAP_TEMPLATE_BY_KEY[key]),
      enabled: !!client,
      refetchInterval: pollIntervalWithBackoff(30_000),
      staleTime: 25_000,
    })),
  })

  const byKey = Object.fromEntries(BOOTSTRAP_QUERY_KEYS.map((k, i) => [k, queries[i]])) as Record<
    BootstrapQueryKey,
    (typeof queries)[number]
  >

  return useMemo(
    () =>
      buildBootstrapResult({
        roleSetup: byKey['role-setup'],
        schedulerRole: byKey['scheduler-role'],
        holidayCalendar: byKey['holiday-calendar'],
        lifecycleRule: byKey['lifecycle-rule'],
        eventFactory: byKey['event-factory'],
        irsFactory: byKey['irs-factory'],
        cdsFactory: byKey['cds-factory'],
        ccyFactory: byKey['ccy-factory'],
        fxFactory: byKey['fx-factory'],
        assetFactory: byKey['asset-factory'],
        fpmlFactory: byKey['fpml-factory'],
        cashSetup: byKey['cash-setup'],
        demoProvider: byKey['demo-provider'],
        nyfedProvider: byKey['nyfed-provider'],
      }),
    [byKey],
  )
}
