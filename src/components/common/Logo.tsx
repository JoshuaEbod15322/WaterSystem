import { Droplets } from 'lucide-react'
import { Link } from 'react-router-dom'
import { APP_NAME } from '../../utils/constants'

export function Logo({
  to = '/',
  compact = false,
  light = false,
}: {
  to?: string
  compact?: boolean
  light?: boolean
}) {
  return (
    <Link to={to} className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 text-white shadow-sm">
        <Droplets className="h-5 w-5" />
      </span>
      {!compact ? (
        <span className="leading-tight">
          <span
            className={`block text-base font-bold tracking-tight ${light ? 'text-white' : 'text-slate-900'}`}
          >
            {APP_NAME}
          </span>
          <span
            className={`block text-[10px] font-semibold uppercase tracking-[0.16em] ${light ? 'text-brand-100' : 'text-slate-400'}`}
          >
            Water Refilling Station
          </span>
        </span>
      ) : null}
    </Link>
  )
}
