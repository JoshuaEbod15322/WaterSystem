import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { ClipboardList, Menu, Route, X } from 'lucide-react'
import { AppSidebar, type SidebarItem } from '../components/layout/AppSidebar'
import { Logo } from '../components/common/Logo'
import { SetupNotice } from '../components/common/SetupNotice'

const navItems: SidebarItem[] = [
  { to: '/driver', label: 'Deliveries', icon: ClipboardList, end: true },
  { to: '/driver/history', label: 'History', icon: Route },
]

export function DriverLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  return (
    <div className="min-h-screen bg-slate-100">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">
        <AppSidebar
          items={navItems}
          homeTo="/driver"
          sectionLabel="Driver"
          roleLabel="Delivery Driver"
          accent="emerald"
        />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/60"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          />
          <div className="relative h-full w-72 max-w-[85vw] shadow-2xl animate-slide-up">
            <AppSidebar
              items={navItems}
              homeTo="/driver"
              sectionLabel="Driver"
              roleLabel="Delivery Driver"
              accent="emerald"
              onNavigate={() => setMobileOpen(false)}
            />
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Logo to="/driver" />
        </header>

        <SetupNotice />

        <main className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
