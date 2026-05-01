'use client'

interface PartyCardProps {
  label: string
  role: string
  description: string
  onClick: () => void
}

export function PartyCard({ label, role, description, onClick }: PartyCardProps) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-left transition-colors hover:border-blue-500/50 hover:bg-zinc-800"
    >
      <div className="text-lg font-semibold text-white group-hover:text-blue-400 transition-colors">
        {label}
      </div>
      <div className="text-sm font-medium text-zinc-400 group-hover:text-blue-300 transition-colors">
        {role}
      </div>
      <div className="text-sm text-zinc-500">{description}</div>
    </button>
  )
}
