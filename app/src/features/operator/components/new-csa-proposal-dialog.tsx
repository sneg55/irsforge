'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useLedgerClient } from '@/shared/hooks/use-ledger-client'
import { useCsaFormDefaults } from '../hooks/use-csa-form-defaults'
import { CSA_PROPOSALS_QUERY_KEY } from '../hooks/use-csa-proposals'
import { proposeCsa } from '../ledger/csa-proposal-actions'
import { CsaProposalFormFields } from './csa-proposal-form-fields'
import {
  type FormState,
  INITIAL_FORM,
  INITIAL_TOUCHED,
  type TouchedState,
} from './csa-proposal-form-types'
import { validateForm } from './csa-proposal-validation'

interface Props {
  open: boolean
  onClose: () => void
}

export function NewCsaProposalDialog({ open, onClose }: Props) {
  const { client, activeParty } = useLedgerClient()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [touched, setTouched] = useState<TouchedState>(INITIAL_TOUCHED)
  const { currencies, defaultCcy, counterpartyOptions, defaultCounterparty, findMasterAgreement } =
    useCsaFormDefaults(activeParty)

  // Seed CCY + counterparty fields with the YAML defaults once the config
  // arrives. Avoids overwriting whatever the user already picked.
  useEffect(() => {
    if (!defaultCcy && !defaultCounterparty) return
    setForm((f) => {
      const valuationCcy = f.valuationCcy || defaultCcy
      const counterpartyHint = f.counterpartyHint || defaultCounterparty
      const eligible = f.eligible.map((row) =>
        row.currency ? row : { ...row, currency: defaultCcy },
      )
      if (
        valuationCcy === f.valuationCcy &&
        counterpartyHint === f.counterpartyHint &&
        eligible === f.eligible
      )
        return f
      return { ...f, valuationCcy, counterpartyHint, eligible }
    })
  }, [defaultCcy, defaultCounterparty])

  // Pin ISDA MA + governing law from YAML when the selected counterparty has
  // a registered Master Agreement. When the trader changes counterparty,
  // re-pin from the new pair (or clear back to free-text if the new pair
  // isn't registered). Does not clobber what the user typed when the pair
  // is unregistered.
  const pinnedMa = findMasterAgreement(form.counterpartyHint)
  useEffect(() => {
    if (!pinnedMa) return
    setForm((f) =>
      f.isdaMasterAgreementRef === pinnedMa.reference && f.governingLaw === pinnedMa.governingLaw
        ? f
        : { ...f, isdaMasterAgreementRef: pinnedMa.reference, governingLaw: pinnedMa.governingLaw },
    )
  }, [pinnedMa?.reference, pinnedMa?.governingLaw])

  const errors = validateForm(form, activeParty)
  const isValid = errors.length === 0

  function fieldError(field: string): string | undefined {
    return errors.find((e) => e.field === field)?.msg
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error('No client')
      return await proposeCsa(client, {
        proposerHint: activeParty ?? '',
        counterpartyHint: form.counterpartyHint.trim(),
        thresholdDirA: parseFloat(form.thresholdDirA),
        thresholdDirB: parseFloat(form.thresholdDirB),
        mta: parseFloat(form.mta),
        rounding: parseFloat(form.rounding),
        eligible: form.eligible,
        valuationCcy: form.valuationCcy.trim(),
        isdaMasterAgreementRef: form.isdaMasterAgreementRef.trim(),
        governingLaw: form.governingLaw,
        imAmount: parseFloat(form.imAmount),
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [CSA_PROPOSALS_QUERY_KEY] })
      setForm({
        ...INITIAL_FORM,
        counterpartyHint: defaultCounterparty,
        valuationCcy: defaultCcy,
        eligible: [{ currency: defaultCcy, haircut: '0' }],
      })
      setTouched(INITIAL_TOUCHED)
      onClose()
    },
  })

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
    >
      <div className="w-full max-w-lg rounded-lg border border-zinc-700 bg-zinc-900 p-6 shadow-xl">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-300">
          New CSA proposal
        </h3>

        <CsaProposalFormFields
          form={form}
          setForm={setForm}
          touched={touched}
          setTouched={setTouched}
          activeParty={activeParty}
          fieldError={fieldError}
          currencies={currencies}
          counterpartyOptions={counterpartyOptions}
          defaultCcy={defaultCcy}
          pinnedMa={pinnedMa}
        />

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            className="rounded px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-100"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            data-testid="submit-proposal"
            type="button"
            disabled={!isValid || mutation.isPending}
            className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40 hover:bg-blue-500"
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  )
}
