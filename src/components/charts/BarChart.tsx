export interface BarDatum {
  key: string
  label: string
  value: number
  caption?: string
}

/**
 * Simple bar chart built with flex boxes. Bars scroll horizontally on narrow
 * screens and expose the exact value through the native title tooltip.
 */
export function BarChart({
  data,
  formatValue,
  color = '#2089ed',
  heightClass = 'h-52',
  emptyLabel = 'No data for this period yet.',
}: {
  data: BarDatum[]
  formatValue: (value: number) => string
  color?: string
  heightClass?: string
  emptyLabel?: string
}) {
  const max = Math.max(...data.map((item) => item.value), 0)

  if (data.length === 0 || max === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-slate-200 px-4 text-center text-xs text-slate-400">
        {emptyLabel}
      </div>
    )
  }

  return (
    <div className={`overflow-x-auto ${heightClass}`}>
      <div className="flex h-full min-w-full items-end gap-1.5">
        {data.map((item) => {
          const height =
            item.value > 0 ? Math.max((item.value / max) * 100, 4) : 2
          return (
            <div
              key={item.key}
              className="flex h-full min-w-[24px] flex-1 flex-col justify-end gap-1"
              title={`${item.label}: ${formatValue(item.value)}${
                item.caption ? ` · ${item.caption}` : ''
              }`}
            >
              <div className="flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-t-md transition"
                  style={{
                    height: `${height}%`,
                    backgroundColor: item.value > 0 ? color : '#e2e8f0',
                  }}
                  aria-label={`${item.label}: ${formatValue(item.value)}`}
                />
              </div>
              <span className="truncate text-center text-[9px] text-slate-400">
                {item.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
