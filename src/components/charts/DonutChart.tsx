import type { ReactNode } from 'react'

export interface DonutSegment {
  label: string
  value: number
  color: string
}

/**
 * Lightweight SVG donut chart. Segments are drawn as stroke arcs so the chart
 * stays crisp at any size without a charting dependency.
 */
export function DonutChart({
  segments,
  centerValue,
  centerLabel,
  size = 176,
  thickness = 18,
}: {
  segments: DonutSegment[]
  centerValue: ReactNode
  centerLabel?: string
  size?: number
  thickness?: number
}) {
  const total = segments.reduce(
    (sum, segment) => sum + Math.max(0, segment.value),
    0,
  )
  const radius = 40
  const circumference = 2 * Math.PI * radius
  const gap = segments.length > 1 ? 2.5 : 0

  const arcs = segments.map((segment, index) => {
    const value = Math.max(0, segment.value)
    const fraction = total > 0 ? value / total : 0
    const previous = segments
      .slice(0, index)
      .reduce((sum, item) => sum + Math.max(0, item.value), 0)
    const offsetFraction = total > 0 ? previous / total : 0
    const length = Math.max(fraction * circumference - gap, 0)
    return {
      ...segment,
      value,
      dashArray: `${length} ${circumference - length}`,
      dashOffset: -offsetFraction * circumference,
    }
  })

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        className="-rotate-90"
        role="img"
        aria-label={`${segments
          .map((segment) => `${segment.label}: ${segment.value}`)
          .join(', ')}`}
      >
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={thickness}
        />
        {arcs
          .filter((arc) => arc.value > 0)
          .map((arc) => (
            <circle
              key={arc.label}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={arc.color}
              strokeWidth={thickness}
              strokeDasharray={arc.dashArray}
              strokeDashoffset={arc.dashOffset}
            />
          ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-2xl font-bold tabular-nums text-slate-900">
          {centerValue}
        </span>
        {centerLabel ? (
          <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {centerLabel}
          </span>
        ) : null}
      </div>
    </div>
  )
}
