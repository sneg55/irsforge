'use client'

import { useState } from 'react'

interface Underlying {
  assetId: string
  weight: number
  initialPrice: number
  currentPrice: number
}

interface UnderlyingsEditorProps {
  underlyings: Underlying[]
  editable: boolean
  onChange: (underlyings: Underlying[]) => void
}

const DEFAULT_UNDERLYING: Underlying = {
  assetId: '',
  weight: 1.0,
  initialPrice: 100,
  currentPrice: 100,
}

export function UnderlyingsEditor({ underlyings, editable, onChange }: UnderlyingsEditorProps) {
  const totalWeight = underlyings.reduce((sum, u) => sum + u.weight, 0)
  const weightWarning = Math.abs(totalWeight - 1.0) > 0.001

  const update = (index: number, field: keyof Underlying, raw: string) => {
    const next = underlyings.map((u, i) => {
      if (i !== index) return u
      if (field === 'assetId') return { ...u, assetId: raw }
      const num = parseFloat(raw)
      if (isNaN(num)) return u
      if (field === 'weight') return { ...u, weight: num / 100 }
      if (field === 'initialPrice') return { ...u, initialPrice: num, currentPrice: num }
      return u
    })
    onChange(next)
  }

  const add = () => {
    onChange([...underlyings, { ...DEFAULT_UNDERLYING }])
  }

  const remove = (index: number) => {
    if (underlyings.length <= 1) return
    onChange(underlyings.filter((_, i) => i !== index))
  }

  return (
    <div className="mt-1">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-3xs text-[#555b6e] uppercase tracking-wider">Underlyings</span>
      </div>
      <table className="w-full text-3xs border-collapse">
        <thead>
          <tr className="text-[#555b6e] text-left">
            <th className="py-1 px-1 font-normal">Asset ID</th>
            <th className="py-1 px-1 font-normal text-right w-[52px]">Weight</th>
            <th className="py-1 px-1 font-normal text-right w-[62px]">Ref Price</th>
            {editable && <th className="py-1 px-1 w-[18px]" />}
          </tr>
        </thead>
        <tbody>
          {underlyings.map((u, i) => (
            <UnderlyingRow
              key={i}
              underlying={u}
              editable={editable}
              canRemove={editable && underlyings.length > 1}
              onUpdate={(field, value) => update(i, field, value)}
              onRemove={() => remove(i)}
            />
          ))}
        </tbody>
      </table>
      {weightWarning && (
        <p className="text-3xs text-amber-500 mt-1">
          Weights sum to {(totalWeight * 100).toFixed(0)}%
        </p>
      )}
      {editable && (
        <button
          onClick={add}
          className="mt-1.5 w-full text-3xs text-[#555b6e] bg-[#1e2235] border border-dashed border-[#333] rounded py-0.5 hover:border-[#555b6e] hover:text-zinc-400 transition-colors"
        >
          + Add Underlying
        </button>
      )}
    </div>
  )
}

function UnderlyingRow({
  underlying,
  editable,
  canRemove,
  onUpdate,
  onRemove,
}: {
  underlying: Underlying
  editable: boolean
  canRemove: boolean
  onUpdate: (field: keyof Underlying, value: string) => void
  onRemove: () => void
}) {
  const [editingField, setEditingField] = useState<string | null>(null)

  const cell = (
    field: 'assetId' | 'weight' | 'initialPrice',
    display: string,
    align: 'left' | 'right' = 'left',
  ) => {
    const isEditing = editingField === field
    const rawValue =
      field === 'weight'
        ? (underlying.weight * 100).toFixed(0)
        : field === 'initialPrice'
          ? String(underlying.initialPrice)
          : underlying.assetId

    if (editable && isEditing) {
      return (
        <td className={`py-0.5 px-1 ${align === 'right' ? 'text-right' : ''}`}>
          <input
            autoFocus
            className="w-full bg-[#1e2235] border border-[#f59e0b]/50 rounded px-1 py-px font-mono text-3xs text-white outline-hidden"
            style={{ textAlign: align }}
            defaultValue={rawValue}
            onBlur={(e) => {
              onUpdate(field, e.target.value)
              setEditingField(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onUpdate(field, (e.target as HTMLInputElement).value)
                setEditingField(null)
              }
              if (e.key === 'Escape') setEditingField(null)
            }}
          />
        </td>
      )
    }

    return (
      <td
        className={`py-0.5 px-1 ${align === 'right' ? 'text-right' : ''} ${editable ? 'cursor-pointer hover:bg-[#1e2235]/50' : ''}`}
        onClick={() => editable && setEditingField(field)}
      >
        <span
          className={`bg-[#1e2235] rounded px-1 py-px inline-block font-mono ${field === 'assetId' ? 'text-blue-400' : 'text-white'}`}
        >
          {display}
        </span>
      </td>
    )
  }

  return (
    <tr className="border-t border-[#1e2235]">
      {cell('assetId', underlying.assetId || '—')}
      {cell('weight', `${(underlying.weight * 100).toFixed(0)}%`, 'right')}
      {cell('initialPrice', underlying.initialPrice.toLocaleString(), 'right')}
      {editable && (
        <td className="py-0.5 px-1 text-center">
          {canRemove && (
            <button
              onClick={onRemove}
              className="text-[#555b6e] hover:text-red-400 transition-colors text-xs leading-none"
            >
              &times;
            </button>
          )}
        </td>
      )}
    </tr>
  )
}
