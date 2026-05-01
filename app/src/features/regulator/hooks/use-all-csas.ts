'use client'

import { useQuery } from '@tanstack/react-query'
import { type CsaViewModel, decodeCsa } from '@/features/csa/decode'
import { useLedgerClient } from '@/shared/hooks/use-ledger-client'
import { CSA_TEMPLATE_ID } from '@/shared/ledger/template-ids'
import type { ContractResult, CsaPayload } from '@/shared/ledger/types'

const REFETCH_MS = 5_000

export interface UseAllCsasResult {
  data: CsaViewModel[]
  isLoading: boolean
  error: Error | null
}

/**
 * Cross-org CSA query for the regulator surface. Reuses `decodeCsa` from
 * the trader feature — the decoder is party-agnostic. The regulator's JWT
 * returns every Csa contract because the regulator is signatory/observer
 * on every CSA in the deployment.
 */
export function useAllCsas(): UseAllCsasResult {
  const { client, activeParty } = useLedgerClient()
  const q = useQuery<CsaViewModel[]>({
    queryKey: ['regulator', 'csas', activeParty],
    queryFn: async () => {
      if (!client) return []
      const raw = await client.query<ContractResult<CsaPayload>>(CSA_TEMPLATE_ID)
      return raw.map((r) => decodeCsa(r.contractId, r.payload))
    },
    enabled: !!client,
    refetchInterval: REFETCH_MS,
  })
  return {
    data: q.data ?? [],
    isLoading: q.isLoading,
    error: q.error ?? null,
  }
}
