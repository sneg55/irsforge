'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { parseDate } from '../utils/date-parser'

interface EditableDateProps {
  value: Date
  onChange: (date: Date) => void
  isEditable: boolean
  label: string
}

function formatDisplay(d: Date): string {
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })
}

export function EditableDate({ value, onChange, isEditable, label }: EditableDateProps) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const [flash, setFlash] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.select()
    }
  }, [editing])

  const startEditing = useCallback(() => {
    if (!isEditable) return
    setText(formatDisplay(value))
    setEditing(true)
  }, [isEditable, value])

  const commit = useCallback(() => {
    const parsed = parseDate(text, value)
    if (parsed) {
      onChange(parsed)
      setEditing(false)
    } else {
      setFlash(true)
      setTimeout(() => setFlash(false), 400)
      setText(formatDisplay(value))
    }
  }, [text, value, onChange])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        commit()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setEditing(false)
        setText(formatDisplay(value))
      }
    },
    [commit, value],
  )

  if (editing) {
    return (
      <div>
        <span className="text-[#555b6e]">{label} </span>
        <input
          ref={inputRef}
          type="text"
          className={`bg-transparent font-mono text-[11px] border-b outline-hidden w-[70px] transition-colors ${
            flash ? 'text-red-400 border-red-400' : 'text-white border-[#555b6e]'
          }`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commit}
        />
      </div>
    )
  }

  return (
    <div className={isEditable ? 'cursor-pointer' : ''} onClick={startEditing}>
      <span className="text-[#555b6e]">{label} </span>
      <span className="text-white font-mono">{formatDisplay(value)}</span>
    </div>
  )
}
