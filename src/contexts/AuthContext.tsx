import type { Session } from '@supabase/supabase-js'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Profile, UserRole } from '../types'
import {
  fetchProfile,
  signInWithEmail,
  signOut as signOutRequest,
  signUpCustomer,
  type CustomerSignUpInput,
  type SignUpResult,
} from '../services/auth'
import { isSupabaseConfigured, supabase } from '../services/supabase'

interface AuthContextValue {
  session: Session | null
  profile: Profile | null
  loading: boolean
  configured: boolean
  signIn: (email: string, password: string) => Promise<Profile>
  signUp: (input: CustomerSignUpInput) => Promise<SignUpResult>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  hasRole: (role: UserRole) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      setReady(true)
      return
    }

    let active = true

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return
        setSession(data.session)
        setReady(true)
        if (!data.session) setLoading(false)
      })
      .catch(() => {
        if (active) {
          setReady(true)
          setLoading(false)
        }
      })

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (!nextSession) {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!ready) return

    if (!session) {
      setProfile(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    fetchProfile(session.user.id)
      .then((nextProfile) => {
        if (cancelled) return
        if (nextProfile && !nextProfile.is_active) {
          setProfile(null)
          void supabase.auth.signOut()
          return
        }
        setProfile(nextProfile)
      })
      .catch(() => {
        if (!cancelled) setProfile(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [ready, session])

  const signIn = useCallback(async (email: string, password: string) => {
    const nextProfile = await signInWithEmail(email, password)
    // Sync the session immediately so route guards do not briefly bounce the
    // user back to /login before the auth event fires.
    const { data } = await supabase.auth.getSession()
    setSession(data.session)
    setProfile(nextProfile)
    return nextProfile
  }, [])

  const signUp = useCallback(async (input: CustomerSignUpInput) => {
    const result = await signUpCustomer(input)
    if (result.profile) {
      const { data } = await supabase.auth.getSession()
      setSession(data.session)
      setProfile(result.profile)
    }
    return result
  }, [])

  const signOut = useCallback(async () => {
    await signOutRequest()
    setProfile(null)
    setSession(null)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!session?.user.id) return
    const nextProfile = await fetchProfile(session.user.id)
    setProfile(nextProfile)
  }, [session])

  const hasRole = useCallback(
    (role: UserRole) => profile?.role === role,
    [profile],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      loading,
      configured: isSupabaseConfigured,
      signIn,
      signUp,
      signOut,
      refreshProfile,
      hasRole,
    }),
    [
      session,
      profile,
      loading,
      signIn,
      signUp,
      signOut,
      refreshProfile,
      hasRole,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
