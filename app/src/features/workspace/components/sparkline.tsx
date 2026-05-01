'use client'

export interface SparklineProps {
  values: number[]
  width?: number
  height?: number
  stroke?: string
  zeroBand?: boolean
  /** Hover tooltip rendered as the SVG `<title>`. The blotter passes a
   *  `Trend over Nd · range ±X%` label so a buyer reads the scale and
   *  horizon without leaving the row. */
  tooltip?: string
}

export function Sparkline({
  values,
  width = 80,
  height = 16,
  stroke = '#60a5fa',
  zeroBand = true,
  tooltip,
}: SparklineProps) {
  if (values.length === 0) {
    return (
      <svg width={width} height={height} aria-label="sparkline-empty" role="img">
        {tooltip && <title>{tooltip}</title>}
        <line
          x1={0}
          x2={width}
          y1={height / 2}
          y2={height / 2}
          stroke="#333"
          strokeWidth={1}
          strokeDasharray="2 3"
        />
      </svg>
    )
  }

  if (values.length === 1) {
    // Single-point series (curve-history stream hasn't backfilled yet):
    // polyline needs ≥ 2 points to render a visible stroke, so draw a dot
    // centered in the viewport instead.
    return (
      <svg width={width} height={height} aria-label="sparkline-dot" role="img">
        {tooltip && <title>{tooltip}</title>}
        <circle cx={width / 2} cy={height / 2} r={1.5} fill={stroke} />
      </svg>
    )
  }

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const n = values.length

  const points = values
    .map((v, i) => {
      const x = n === 1 ? width / 2 : (i / (n - 1)) * width
      const y = height - ((v - min) / range) * height
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')

  const zeroY = height - ((0 - min) / range) * height
  const showZeroBand = zeroBand && min < 0 && max > 0

  return (
    <svg
      width={width}
      height={height}
      aria-label="sparkline"
      role="img"
      preserveAspectRatio="none"
      viewBox={`0 0 ${width} ${height}`}
    >
      {tooltip && <title>{tooltip}</title>}
      {showZeroBand && (
        <line
          x1={0}
          x2={width}
          y1={zeroY}
          y2={zeroY}
          stroke="#444"
          strokeWidth={0.5}
          strokeDasharray="1 2"
        />
      )}
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
