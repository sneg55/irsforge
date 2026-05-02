'use client'

import { useState } from 'react'
import { parseNumericInput } from '../utils/format'

export interface FieldDef {
  label: string
  /** Optional React node rendered inline after the label text. */
  labelSuffix?: React.ReactNode
  value: string | number
  editable: boolean
  onChange?: (value: string) => void
  color?: string
  type?: 'text' | 'number' | 'date' | 'select'
  options?: { label: string; value: string }[]
  step?: number
  unit?: string
  tooltip?: string
}

interface FieldGridProps {
  fields: FieldDef[]
}

export function FieldGrid({ fields }: FieldGridProps) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5 text-xs">
      {fields.map((field, i) => (
        <FieldRow key={i} field={field} />
      ))}
    </div>
  )
}

function FieldRow({ field }: { field: FieldDef }) {
  const [editing, setEditing] = useState(false)
  const [localValue, setLocalValue] = useState(String(field.value))

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    if (field.type === 'number' && !/^-?\d*\.?\d*$/.test(raw)) return
    setLocalValue(raw)
  }

  const commitValue = () => {
    setEditing(false)
    if (field.type === 'number') {
      const parsed = parseNumericInput(localValue)
      if (parsed === null) {
        setLocalValue(String(field.value))
        return
      }
      field.onChange?.(String(parsed))
    } else {
      field.onChange?.(localValue)
    }
  }

  const handleBlur = () => commitValue()

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitValue()
    if (e.key === 'Escape') {
      setEditing(false)
      setLocalValue(String(field.value))
    }
  }

  const handleStep = (direction: 1 | -1) => {
    if (!field.step || field.type !== 'number') return
    const current = parseNumericInput(String(field.value))
    if (current === null) return
    const next = current + field.step * direction
    field.onChange?.(String(next))
  }

  const valueStyle = {
    color: field.color || '#fff',
  }

  if (field.editable && field.type === 'select' && field.options) {
    return (
      <>
        <span className="text-[#555b6e] flex items-center gap-1" title={field.tooltip}>
          {field.label}
          {field.labelSuffix}
        </span>
        <select
          className="bg-[#1e2235] rounded px-1.5 py-0.5 font-mono text-xs border border-[#1e2235] outline-hidden appearance-none cursor-pointer hover:border-[#555b6e]/50 focus:border-[#f59e0b]/50"
          style={{
            ...valueStyle,
            colorScheme: 'dark',
            WebkitAppearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5' viewBox='0 0 8 5'%3E%3Cpath fill='%23555b6e' d='M0 0l4 5 4-5z'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 6px center',
          }}
          value={String(field.value)}
          onChange={(e) => field.onChange?.(e.target.value)}
        >
          {field.options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-[#111320] text-white">
              {opt.label}
            </option>
          ))}
        </select>
      </>
    )
  }

  if (field.editable && editing) {
    return (
      <>
        <span className="text-[#555b6e] flex items-center gap-1" title={field.tooltip}>
          {field.label}
          {field.labelSuffix}
        </span>
        <div className="flex items-center gap-0.5">
          <input
            type="text"
            className="flex-1 bg-[#1e2235] rounded px-1.5 py-0.5 font-mono text-xs border border-[#f59e0b]/50 outline-hidden"
            style={valueStyle}
            value={localValue}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          {field.unit && <span className="text-[#555b6e] text-3xs shrink-0">{field.unit}</span>}
          {field.step != null && (
            <div className="flex flex-col -my-0.5">
              <button
                className="text-[7px] text-[#555b6e] hover:text-white leading-none px-0.5"
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleStep(1)
                }}
              >
                ▲
              </button>
              <button
                className="text-[7px] text-[#555b6e] hover:text-white leading-none px-0.5"
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleStep(-1)
                }}
              >
                ▼
              </button>
            </div>
          )}
        </div>
      </>
    )
  }

  return (
    <>
      <span className="text-[#555b6e] flex items-center gap-1" title={field.tooltip}>
        {field.label}
        {field.labelSuffix}
      </span>
      <div className="flex items-center gap-0.5">
        <span
          className={`flex-1 bg-[#1e2235] rounded px-1.5 py-0.5 font-mono ${field.editable ? 'cursor-pointer hover:border hover:border-[#555b6e]/50' : ''}`}
          style={{ ...valueStyle, fontWeight: field.color ? 600 : 400 }}
          onClick={() => {
            if (field.editable) {
              // When entering edit mode for number fields, show raw value
              if (field.type === 'number') {
                const parsed = parseNumericInput(String(field.value))
                setLocalValue(parsed !== null ? String(parsed) : String(field.value))
              } else {
                setLocalValue(String(field.value))
              }
              setEditing(true)
            }
          }}
        >
          {typeof field.value === 'number' ? field.value.toLocaleString() : field.value}
        </span>
        {field.editable && field.step != null && !editing && (
          <div className="flex flex-col -my-0.5">
            <button
              className="text-[7px] text-[#555b6e] hover:text-white leading-none px-0.5"
              onClick={() => handleStep(1)}
            >
              ▲
            </button>
            <button
              className="text-[7px] text-[#555b6e] hover:text-white leading-none px-0.5"
              onClick={() => handleStep(-1)}
            >
              ▼
            </button>
          </div>
        )}
      </div>
    </>
  )
}
