'use client'

import { FieldGrid } from './field-grid'

interface Props {
  creditSpread: number
  editable: boolean
  onChange: (v: number) => void
}

export function CdsPanel({ creditSpread, editable, onChange }: Props) {
  return (
    <div className="px-3.5 py-2 w-[280px]">
      <FieldGrid
        fields={[
          {
            label: 'Credit Spread',
            value: `${Math.round(creditSpread * 10000)} bp`,
            editable,
            type: 'number',
            step: 1,
            unit: 'bp',
            onChange: (v) => onChange((parseFloat(v) || 0) / 10000),
            tooltip: 'Trade-level CDS premium spread (bp)',
          },
        ]}
      />
    </div>
  )
}
