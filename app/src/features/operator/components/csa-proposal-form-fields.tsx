'use client'

import { PartyName } from 'canton-party-directory/ui'
import { lawDisplay } from '@/features/csa/governing-law'
import type { EligibleCollateralPayload } from '@/shared/ledger/csa-types'
import type { MasterAgreementMatch } from '../hooks/use-csa-form-defaults'
import type { FormState, TouchedState } from './csa-proposal-form-types'
import { eligibleRowErrors } from './csa-proposal-validation'
import { EligibleCollateralRow } from './eligible-collateral-row'

interface CounterpartyOption {
  hint: string
  displayName: string
}

interface CurrencyOption {
  code: string
  label: string
}

export interface CsaProposalFormFieldsProps {
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  touched: TouchedState
  setTouched: React.Dispatch<React.SetStateAction<TouchedState>>
  activeParty: string | null
  fieldError: (field: string) => string | undefined
  currencies: readonly CurrencyOption[]
  counterpartyOptions: readonly CounterpartyOption[]
  defaultCcy: string
  /**
   * When the selected counterparty has a YAML-registered ISDA Master
   * Agreement, the dialog passes it here so the form pins the reference
   * + governing-law as a read-only display instead of free-text inputs.
   * `null` ⇒ no MA on file ⇒ render free-text + governing-law dropdown.
   */
  pinnedMa: MasterAgreementMatch | null
}

export function CsaProposalFormFields({
  form,
  setForm,
  touched,
  setTouched,
  activeParty,
  fieldError,
  currencies,
  counterpartyOptions,
  defaultCcy,
  pinnedMa,
}: CsaProposalFormFieldsProps) {
  function updateEligible(index: number, updated: EligibleCollateralPayload) {
    setForm((f) => {
      const next = [...f.eligible]
      next[index] = updated
      return { ...f, eligible: next }
    })
  }

  function removeEligible(index: number) {
    setForm((f) => ({ ...f, eligible: f.eligible.filter((_, i) => i !== index) }))
  }

  function addEligible() {
    setForm((f) => ({
      ...f,
      eligible: [...f.eligible, { currency: defaultCcy, haircut: '0' }],
    }))
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs text-zinc-400">Counterparty</label>
        <select
          data-testid="counterparty-hint"
          className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-hidden disabled:opacity-50"
          value={form.counterpartyHint}
          disabled={counterpartyOptions.length === 0}
          onChange={(e) => setForm((f) => ({ ...f, counterpartyHint: e.target.value }))}
          onBlur={() => setTouched((t) => ({ ...t, counterpartyHint: true }))}
        >
          {counterpartyOptions.length === 0 && <option value="">No eligible counterparties</option>}
          {counterpartyOptions.map((org) => (
            <option key={org.hint} value={org.hint}>
              {org.displayName}
            </option>
          ))}
        </select>
        {touched.counterpartyHint && fieldError('counterpartyHint') && (
          <p data-testid="counterparty-error" className="mt-0.5 text-xs text-red-400">
            {fieldError('counterpartyHint')}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 flex items-center gap-1 text-xs text-zinc-400">
            Threshold
            {activeParty ? <PartyName identifier={activeParty} /> : 'Party A'}
          </label>
          <input
            data-testid="threshold-dir-a"
            type="number"
            min="0"
            className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 font-mono text-sm text-zinc-100 focus:border-zinc-500 focus:outline-hidden"
            value={form.thresholdDirA}
            onChange={(e) => setForm((f) => ({ ...f, thresholdDirA: e.target.value }))}
          />
        </div>
        <div>
          <label className="mb-1 flex items-center gap-1 text-xs text-zinc-400">
            Threshold
            {form.counterpartyHint ? <PartyName identifier={form.counterpartyHint} /> : 'Party B'}
          </label>
          <input
            data-testid="threshold-dir-b"
            type="number"
            min="0"
            className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 font-mono text-sm text-zinc-100 focus:border-zinc-500 focus:outline-hidden"
            value={form.thresholdDirB}
            onChange={(e) => setForm((f) => ({ ...f, thresholdDirB: e.target.value }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs text-zinc-400">MTA</label>
          <input
            data-testid="mta"
            type="number"
            min="0"
            className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 font-mono text-sm text-zinc-100 focus:border-zinc-500 focus:outline-hidden"
            value={form.mta}
            onChange={(e) => setForm((f) => ({ ...f, mta: e.target.value }))}
            onBlur={() => setTouched((t) => ({ ...t, mta: true }))}
          />
          {touched.mta && fieldError('mta') && (
            <p data-testid="mta-error" className="mt-0.5 text-xs text-red-400">
              {fieldError('mta')}
            </p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Rounding</label>
          <input
            data-testid="rounding"
            type="number"
            min="0"
            className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 font-mono text-sm text-zinc-100 focus:border-zinc-500 focus:outline-hidden"
            value={form.rounding}
            onChange={(e) => setForm((f) => ({ ...f, rounding: e.target.value }))}
            onBlur={() => setTouched((t) => ({ ...t, rounding: true }))}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs text-zinc-400">Valuation CCY</label>
        <select
          data-testid="valuation-ccy"
          className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 font-mono text-sm text-zinc-100 focus:border-zinc-500 focus:outline-hidden disabled:opacity-50"
          value={form.valuationCcy}
          disabled={currencies.length === 0}
          onChange={(e) => setForm((f) => ({ ...f, valuationCcy: e.target.value }))}
          onBlur={() => setTouched((t) => ({ ...t, valuationCcy: true }))}
        >
          {currencies.length === 0 && <option value="">Loading…</option>}
          {currencies.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} · {c.label}
            </option>
          ))}
        </select>
      </div>

      {pinnedMa ? (
        <div
          data-testid="isda-ma-pinned"
          className="rounded border border-zinc-700 bg-zinc-800/50 px-3 py-2 text-xs"
        >
          <div className="mb-0.5 text-zinc-500 uppercase tracking-wide">
            ISDA Master Agreement on file
          </div>
          <div className="font-mono text-sm text-zinc-100">{pinnedMa.reference}</div>
          <div className="text-zinc-400">Governed by {lawDisplay(pinnedMa.governingLaw)}</div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-zinc-400">ISDA MA reference</label>
            <input
              data-testid="isda-ma-ref"
              type="text"
              placeholder="e.g. ISDA-2002-Goldman-DB-2024-01-15"
              className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-hidden"
              value={form.isdaMasterAgreementRef}
              onChange={(e) => setForm((f) => ({ ...f, isdaMasterAgreementRef: e.target.value }))}
              onBlur={() => setTouched((t) => ({ ...t, isdaMasterAgreementRef: true }))}
            />
            {touched.isdaMasterAgreementRef && fieldError('isdaMasterAgreementRef') && (
              <p data-testid="isda-ma-ref-error" className="mt-0.5 text-xs text-red-400">
                {fieldError('isdaMasterAgreementRef')}
              </p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-400">Governing law</label>
            <select
              data-testid="governing-law"
              className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-hidden"
              value={form.governingLaw}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  governingLaw: e.target.value as FormState['governingLaw'],
                }))
              }
            >
              <option value="NewYork">New York</option>
              <option value="English">English</option>
              <option value="Japanese">Japanese</option>
            </select>
          </div>
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs text-zinc-400">
          Initial Margin ({form.valuationCcy || 'CCY'})
        </label>
        <input
          data-testid="im-amount"
          type="number"
          min="0"
          className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-1.5 font-mono text-sm text-zinc-100 focus:border-zinc-500 focus:outline-hidden"
          value={form.imAmount}
          onChange={(e) => setForm((f) => ({ ...f, imAmount: e.target.value }))}
          onBlur={() => setTouched((t) => ({ ...t, imAmount: true }))}
        />
        {touched.imAmount && fieldError('imAmount') && (
          <p data-testid="im-amount-error" className="mt-0.5 text-xs text-red-400">
            {fieldError('imAmount')}
          </p>
        )}
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs text-zinc-400">Eligible collateral (CCY / haircut)</label>
          <button
            type="button"
            className="text-xs text-zinc-400 hover:text-zinc-100"
            onClick={addEligible}
          >
            + Add row
          </button>
        </div>
        <div className="space-y-2">
          {form.eligible.map((row, i) => (
            <EligibleCollateralRow
              key={i}
              index={i}
              row={row}
              currencies={currencies}
              onChange={updateEligible}
              onRemove={removeEligible}
              errors={eligibleRowErrors(row)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
