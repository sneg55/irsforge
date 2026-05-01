'use client'

import type { EligibleCollateralPayload } from '@/shared/ledger/csa-types'

interface CurrencyOption {
  code: string
  label: string
  isDefault?: boolean
}

interface Props {
  index: number
  row: EligibleCollateralPayload
  currencies: readonly CurrencyOption[]
  onChange: (index: number, updated: EligibleCollateralPayload) => void
  onRemove: (index: number) => void
  errors: { currency?: string; haircut?: string }
}

export function EligibleCollateralRow({
  index,
  row,
  currencies,
  onChange,
  onRemove,
  errors,
}: Props) {
  return (
    <div className="flex items-start gap-2">
      <div className="flex-1">
        <select
          data-testid={`eligible-ccy-${index}`}
          className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 font-mono text-sm text-zinc-100 focus:border-zinc-500 focus:outline-hidden disabled:opacity-50"
          value={row.currency}
          disabled={currencies.length === 0}
          onChange={(e) => onChange(index, { ...row, currency: e.target.value })}
        >
          {currencies.length === 0 && <option value="">Loading…</option>}
          {currencies.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code}
            </option>
          ))}
        </select>
        {errors.currency !== undefined && errors.currency !== '' && (
          <p className="mt-0.5 text-xs text-red-400">{errors.currency}</p>
        )}
      </div>
      <div className="flex-1">
        <input
          data-testid={`eligible-haircut-${index}`}
          className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 font-mono text-sm text-zinc-100 placeholder-zinc-600 focus:border-zinc-500 focus:outline-hidden"
          placeholder="0.02"
          type="number"
          step="0.01"
          min="0"
          max="1"
          value={row.haircut}
          onChange={(e) => onChange(index, { ...row, haircut: e.target.value })}
        />
        {errors.haircut !== undefined && errors.haircut !== '' && (
          <p className="mt-0.5 text-xs text-red-400">{errors.haircut}</p>
        )}
      </div>
      <button
        type="button"
        className="mt-1 text-xs text-zinc-500 hover:text-red-400"
        onClick={() => onRemove(index)}
      >
        ✕
      </button>
    </div>
  )
}
