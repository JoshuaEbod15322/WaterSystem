import { useId } from 'react'

export interface LineDatum {
  key: string
  label: string
  value: number
}

/**
 * Compact SVG line/area chart for order-volume trends. Dots are positioned in
 * the container so they stay circular at any aspect ratio.
 */
export function LineChart({
  data,
  color = '#2089ed',
  formatValue,
  heightClass = 'h-44',
  emptyLabel = 'No data for this period yet.',
}: {
  data: LineDatum[]
  color?: string
  formatValue: (value: number) => string
  heightClass?: string
  emptyLabel?: string
}) {
  const gradientId = useId().replace(/:/g, '')
  const max = Math.max(...data.map((item) => item.value), 0)

  if (data.length === 0 || max === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-slate-200 px-4 text-center text-xs text-slate-400">
        {emptyLabel}
      </div>
    )
  }

  const points = data.map((item, index) => ({
    ...item,
    x:
      data.length === 1
        ? 50
        : 4 + (index / (data.length - 1)) * 92,
    y: 8 + (1 - item.value / max) * 84,
  }))

  const line = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')
  const area = `${line} L 100 100 L 0 100 Z`

  return (
    <div>
      <div className={`relative ${heightClass}`}>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          role="img"
          aria-label={`Order trend: ${data
            .map((item) => `${item.label} ${item.value}`)
            .join(', ')}`}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.24" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[25, 50, 75].map((y) => (
            <line
              key={y}
              x1="0"
              x2="100"
              y1={y}
              y2={y}
              stroke="#e2e8f0"
              strokeWidth="1"
              strokeDasharray="2 2"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <path d={area} fill={`url(#${gradientId})`} />
          <path
            d={line}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {points.map((point) => (
          <span
            key={point.key}
            title={`${point.label}: ${formatValue(point.value)}`}
            className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm"
            style={{
              left: `${point.x}%`,
              top: `${point.y}%`,
              backgroundColor: color,
            }}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[9px] text-slate-400">
        <span>{data[0]?.label}</span>
        {data.length > 2 ? (
          <span>{data[Math.floor(data.length / 2)]?.label}</span>
        ) : null}
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  )
}
