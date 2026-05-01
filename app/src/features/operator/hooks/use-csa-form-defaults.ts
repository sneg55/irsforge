'use client'

import { useCallback, useMemo } from 'react'
import { useConfig } from '@/shared/contexts/config-context'

interface CurrencyOption {
  code: string
  label: string
  isDefault?: boolean
}

interface CounterpartyOption {
  hint: string
  displayName: string
}

export type GoverningLaw = 'NewYork' | 'English' | 'Japanese'

export interface MasterAgreementMatch {
  reference: string
  governingLaw: GoverningLaw
}

export interface CsaFormDefaults {
  currencies: readonly CurrencyOption[]
  defaultCcy: string
  counterpartyOptions: readonly CounterpartyOption[]
  defaultCounterparty: string
  /**
   * Returns the registered ISDA Master Agreement for the unordered party
   * pair `(activeParty, counterpartyHint)` if YAML config has one, else
   * `null`. The proposal modal renders the MA + governing law as a
   * read-only pinned display when found, free-text inputs when not.
   */
  findMasterAgreement: (counterpartyHint: string) => MasterAgreementMatch | null
}

/**
 * Pulls the New-CSA-proposal dropdown options out of YAML config.
 *
 * Counterparty options come from the orgs list filtered down to
 * role==='trader' (and excluding the active party). The role tag lives
 * on each org in shared-config; cardinality is enforced server-side, so
 * the dropdown can trust whatever orgs the API sends. Currency options
 * come straight from `currencies` in the YAML; the `isDefault` flag picks
 * the initial selection.
 */
export function useCsaFormDefaults(activeParty: string | null): CsaFormDefaults {
  const { config } = useConfig()

  const currencies = useMemo(() => config?.currencies ?? [], [config])
  const defaultCcy = useMemo(
    () => currencies.find((c) => c.isDefault)?.code ?? currencies[0]?.code ?? '',
    [currencies],
  )

  const counterpartyOptions = useMemo(
    () => (config?.orgs ?? []).filter((org) => org.role === 'trader' && org.hint !== activeParty),
    [config, activeParty],
  )
  const defaultCounterparty = useMemo(
    () => counterpartyOptions[0]?.hint ?? '',
    [counterpartyOptions],
  )

  const masterAgreements = useMemo(() => config?.masterAgreements ?? [], [config])
  const findMasterAgreement = useCallback(
    (counterpartyHint: string): MasterAgreementMatch | null => {
      if (!activeParty || !counterpartyHint) return null
      const ma = masterAgreements.find((entry) => {
        const [a, b] = entry.parties
        return (
          (a === activeParty && b === counterpartyHint) ||
          (a === counterpartyHint && b === activeParty)
        )
      })
      return ma ? { reference: ma.reference, governingLaw: ma.governingLaw } : null
    },
    [masterAgreements, activeParty],
  )

  return {
    currencies,
    defaultCcy,
    counterpartyOptions,
    defaultCounterparty,
    findMasterAgreement,
  }
}
