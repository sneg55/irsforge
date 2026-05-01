'use client'

import type { ReactNode } from 'react'

export type TabKey = 'valuation' | 'risk' | 'solver'

export interface TabDef {
  key: TabKey
  label: string
}

interface TabStripProps {
  tabs: TabDef[]
  active: TabKey
  onChange: (key: TabKey) => void
  children: ReactNode
}

export function TabStrip({ tabs, active, onChange, children }: TabStripProps) {
  return (
    <div>
      <div
        className="flex items-center border-b border-[#1e2235] overflow-x-auto"
        role="tablist"
        aria-label="Workspace right panel"
      >
        {tabs.map((t) => {
          const isActive = t.key === active
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(t.key)}
              className={`px-3 py-2 text-[10px] font-semibold tracking-wider uppercase transition-colors whitespace-nowrap border-b-2 ${
                isActive
                  ? 'text-white border-[#3b82f6]'
                  : 'text-[#555b6e] border-transparent hover:text-[#8b8fa3]'
              }`}
            >
              {t.label}
            </button>
          )
        })}
      </div>
      <div role="tabpanel">{children}</div>
    </div>
  )
}
