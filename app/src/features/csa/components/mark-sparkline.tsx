'use client'

import type { MarkViewModel } from '../decode'

interface Props {
  history: MarkViewModel[]
  width?: number
  height?: number
}

export function MarkSparkline({ history, width = 160, height = 36 }: Props) {
  if (history.length < 2) {
    return <div className="text-3xs text-zinc-600 italic">no marks yet</div>
  }
  const exposures = history.map((m) => m.exposure)
  const min = Math.min(...exposures)
  const max = Math.max(...exposures)
  const range = max - min || 1
  const points = exposures
    .map((e, i) => {
      const x = (i / (exposures.length - 1)) * width
      const y = height - ((e - min) / range) * height
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  const last = exposures[exposures.length - 1]
  const stroke = last > 0 ? '#ef4444' : '#22c55e'
  return (
    <svg width={width} height={height} className="block">
      <polyline fill="none" stroke={stroke} strokeWidth={1.5} points={points} />
    </svg>
  )
}
