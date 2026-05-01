'use client'

import { useQuery } from '@tanstack/react-query'
import { useLedgerClient } from '@/shared/hooks/use-ledger-client'
import { CSA_TEMPLATE_ID } from '@/shared/ledger/template-ids'
import type { ContractResult, CsaPayload } from '@/shared/ledger/types'
import { type CsaViewModel, decodeCsa } from '../decode'

const CSA_REFETCH_INTERVAL_MS = 5_000

export interface UseCsasResult {
  data: CsaViewModel[]
  isLoading: boolean
  isFetching: boolean
  error: Error | null
  refetch: () => void
}

export function useCsas(): UseCsasResult {
  const { client, activeParty } = useLedgerClient()
  const query = useQuery<CsaViewModel[]>({
    queryKey: ['csas', activeParty],
    queryFn: async () => {
      if (!client) return []
      const raw = await client.query<ContractResult<CsaPayload>>(CSA_TEMPLATE_ID)
      return raw.map((r) => decodeCsa(r.contractId, r.payload))
    },
    enabled: !!client,
    refetchInterval: CSA_REFETCH_INTERVAL_MS,
  })
  return {
    data: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error ?? null,
    refetch: () => {
      void query.refetch()
    },
  }
}
