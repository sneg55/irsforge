'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Tenor } from '../utils/tenor-parser'
import { formatTenor, parseTenor } from '../utils/tenor-parser'

const DEFAULT_PRESETS = ['1Y', '2Y', '3Y', '5Y', '7Y', '10Y', '15Y', '20Y', '30Y']

interface EditableTenorProps {
  value: Tenor
  onChange: (tenor: Tenor) => void
  isEditable: boolean
  presets?: string[]
}

export function EditableTenor({
  value,
  onChange,
  isEditable,
  presets = DEFAULT_PRESETS,
}: EditableTenorProps) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const [flash, setFlash] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.select()
    }
  }, [editing])

  const startEditing = useCallback(() => {
    if (!isEditable) return
    setText(formatTenor(value))
    setEditing(true)
  }, [isEditable, value])

  const commitTenor = useCallback(
    (tenor: Tenor) => {
      onChange(tenor)
      setEditing(false)
    },
    [onChange],
  )

  const commit = useCallback(() => {
    const parsed = parseTenor(text)
    if (parsed) {
      commitTenor(parsed)
    } else {
      setFlash(true)
      setTimeout(() => setFlash(false), 400)
      setText(formatTenor(value))
    }
  }, [text, value, commitTenor])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        commit()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setEditing(false)
        setText(formatTenor(value))
      }
    },
    [commit, value],
  )

  const handleChipClick = useCallback(
    (preset: string) => {
      const parsed = parseTenor(preset)
      if (parsed) commitTenor(parsed)
    },
    [commitTenor],
  )

  // Close chips on outside click
  useEffect(() => {
    if (!editing) return
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        commit()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [editing, commit])

  if (editing) {
    return (
      <div ref={containerRef} className="relative">
        <span className="text-[#555b6e]">Tenor </span>
        <input
          ref={inputRef}
          type="text"
          className={`bg-transparent font-mono text-2xs border-b outline-hidden w-[50px] transition-colors ${
            flash ? 'text-red-400 border-red-400' : 'text-white border-[#555b6e]'
          }`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        {/* Preset chips */}
        <div className="absolute top-full left-0 mt-1 flex gap-0.5 z-50 bg-[#111320] border border-[#1e2235] rounded p-1">
          {presets.map((p) => (
            <button
              key={p}
              onMouseDown={(e) => {
                e.preventDefault() // prevent blur on input
                handleChipClick(p)
              }}
              className={`px-1.5 py-0.5 text-3xs font-mono rounded transition-colors ${
                formatTenor(value) === p
                  ? 'bg-[#f59e0b] text-black'
                  : 'bg-[#1e2235] text-[#8b8fa3] hover:text-white hover:bg-[#2a2f45]'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={isEditable ? 'cursor-pointer' : ''} onClick={startEditing}>
      <span className="text-[#555b6e]">Tenor </span>
      <span className="text-white font-mono">{formatTenor(value)}</span>
    </div>
  )
}
