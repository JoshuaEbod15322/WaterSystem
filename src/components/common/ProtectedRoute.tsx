import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { ROLE_HOME } from '../../utils/constants'
import type { UserRole } from '../../types'
import { FullPageSpinner } from './ui'
import { SetupNotice } from './SetupNotice'

export function ProtectedRoute({
  role,
  children,
}: {
  role: UserRole
  children: ReactNode
}) {
  const { session, profile, loading, configured } = useAuth()
  const location = useLocation()

  if (!configured) {
    return (
      <div className="min-h-screen bg-slate-50">
        <SetupNotice />
        <div className="mx-auto max-w-lg px-4 py-16 text-center">
          <h1 className="text-xl font-semibold text-slate-900">
            Connect your Supabase project
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            The application needs database credentials before it can sign users
            in. Follow the setup section in README.md.
          </p>
        </div>
      </div>
    )
  }

  if (loading) return <FullPageSpinner label="Checking your account…" />

  if (!session || !profile) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (profile.role !== role) {
    return <Navigate to={ROLE_HOME[profile.role]} replace />
  }

  return <>{children}</>
}

export function GuestOnly({ children }: { children: ReactNode }) {
  const { session, profile, loading } = useAuth()

  if (loading) return <FullPageSpinner label="Checking your account…" />

  if (session && profile) {
    return <Navigate to={ROLE_HOME[profile.role]} replace />
  }

  return <>{children}</>
}
