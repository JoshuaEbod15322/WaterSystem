import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import {
  History,
  LayoutDashboard,
  Menu,
  ShoppingCart,
  UserRound,
  X,
} from 'lucide-react'
import { AppSidebar, type SidebarItem } from '../components/layout/AppSidebar'
import { Logo } from '../components/common/Logo'
import { SetupNotice } from '../components/common/SetupNotice'

const navItems: SidebarItem[] = [
  { to: '/customer', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/customer/order', label: 'Order Water', icon: ShoppingCart },
  { to: '/customer/orders', label: 'My Orders', icon: History },
  { to: '/customer/profile', label: 'Profile', icon: UserRound },
]

export function CustomerLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">
        <AppSidebar
          items={navItems}
          homeTo="/customer"
          sectionLabel="Customer"
          roleLabel="Customer"
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
              homeTo="/customer"
              sectionLabel="Customer"
              roleLabel="Customer"
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
          <Logo to="/customer" />
        </header>

        <SetupNotice />

        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
