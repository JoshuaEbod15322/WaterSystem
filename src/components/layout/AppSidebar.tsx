import { NavLink, useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Logo } from '../common/Logo'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'

export interface SidebarItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

const accentClasses = {
  brand: {
    active: 'bg-brand-600 text-white shadow-sm',
    avatar: 'bg-brand-600',
  },
  emerald: {
    active: 'bg-emerald-600 text-white shadow-sm',
    avatar: 'bg-emerald-600',
  },
} as const

export function AppSidebar({
  items,
  homeTo,
  sectionLabel,
  roleLabel,
  accent = 'brand',
  onNavigate,
}: {
  items: SidebarItem[]
  homeTo: string
  sectionLabel: string
  roleLabel: string
  accent?: keyof typeof accentClasses
  onNavigate?: () => void
}) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const colors = accentClasses[accent]

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Unable to sign out.',
      )
    }
  }

  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-300">
      <div className="flex items-center justify-between px-5 py-5">
        <Logo to={homeTo} light />
      </div>

      <p className="px-5 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {sectionLabel}
      </p>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4" aria-label="Main navigation">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? colors.active
                  : 'text-slate-400 hover:bg-slate-900 hover:text-white'
              }`
            }
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-800 p-4">
        <div className="mb-3 flex items-center gap-3">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white ${colors.avatar}`}
          >
            {profile?.full_name?.charAt(0).toUpperCase() || 'A'}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              {profile?.full_name || roleLabel}
            </p>
            <p className="truncate text-xs text-slate-500">
              {profile?.email ?? roleLabel}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-rose-800 hover:bg-rose-950/40 hover:text-rose-200"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  )
}
