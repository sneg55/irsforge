'use client'

interface DirectionToggleProps {
  onToggle: () => void
  disabled?: boolean
}

export function DirectionToggle({ onToggle, disabled }: DirectionToggleProps) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className="text-[#555b6e] text-3xs hover:text-[#8b8fa3] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      ⇄ Flip pay/receive
    </button>
  )
}
