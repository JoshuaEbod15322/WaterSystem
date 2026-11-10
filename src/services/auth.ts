import type { Profile } from '../types'
import { supabase } from './supabase'

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return (data as Profile | null) ?? null
}

async function fetchProfileWithRetry(
  userId: string,
  attempts = 4,
): Promise<Profile | null> {
  let lastError: unknown = null
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const profile = await fetchProfile(userId)
      if (profile) return profile
      lastError = new Error('Profile not found')
    } catch (error) {
      lastError = error
    }
    await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)))
  }
  if (lastError) throw lastError
  return null
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<Profile> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  })

  if (error) throw new Error(error.message)
  if (!data.user) throw new Error('Unable to sign in. Please try again.')

  const profile = await fetchProfileWithRetry(data.user.id)
  if (!profile) {
    await supabase.auth.signOut()
    throw new Error(
      'No profile was found for this account. Contact the administrator.',
    )
  }

  if (!profile.is_active) {
    await supabase.auth.signOut()
    throw new Error(
      'This account has been deactivated. Please contact the water station.',
    )
  }

  return profile
}

export interface CustomerSignUpInput {
  fullName: string
  email: string
  phone: string
  password: string
}

export interface SignUpResult {
  needsEmailConfirmation: boolean
  profile: Profile | null
}

export async function signUpCustomer({
  fullName,
  email,
  phone,
  password,
}: CustomerSignUpInput): Promise<SignUpResult> {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: {
        full_name: fullName.trim(),
        phone: phone.trim(),
      },
    },
  })

  if (error) throw new Error(error.message)
  if (!data.user) throw new Error('Unable to create the account.')

  // Supabase returns an empty identities array when the email is taken.
  if (data.user.identities && data.user.identities.length === 0) {
    throw new Error(
      'An account with this email already exists. Please sign in instead.',
    )
  }

  if (!data.session) {
    return { needsEmailConfirmation: true, profile: null }
  }

  const profile = await fetchProfileWithRetry(data.user.id)
  return { needsEmailConfirmation: false, profile }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw new Error(error.message)
}

export async function updateOwnProfile(
  userId: string,
  patch: Pick<Profile, 'full_name' | 'phone' | 'address'> &
    Partial<Pick<Profile, 'latitude' | 'longitude'>>,
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data as Profile
}
