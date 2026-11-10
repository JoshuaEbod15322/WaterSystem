import type { DriverLocation, Profile } from '../types'
import { supabase } from './supabase'

export interface CreateDriverInput {
  fullName: string
  email: string
  phone: string
  password: string
}

/**
 * Creates a driver account through the admin-only `admin_create_driver` RPC.
 *
 * The database function is the security boundary: any caller who is not an
 * active administrator receives an exception, even if they call the RPC
 * directly. Only the administrator UI exposes this action.
 */
export async function createDriver(input: CreateDriverInput): Promise<Profile> {
  const { data, error } = await supabase.rpc('admin_create_driver', {
    p_email: input.email.trim(),
    p_password: input.password,
    p_full_name: input.fullName.trim(),
    p_phone: input.phone.trim() || null,
  })

  if (error) throw new Error(error.message)
  return data as Profile
}

export async function listDrivers(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'driver')
    .order('full_name', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as Profile[]
}

export async function listCustomers(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'customer')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as Profile[]
}

export async function setProfileActive(
  profileId: string,
  isActive: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ is_active: isActive })
    .eq('id', profileId)

  if (error) throw new Error(error.message)
}

export async function updateProfileAsAdmin(
  profileId: string,
  patch: Pick<Profile, 'full_name' | 'phone'>,
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', profileId)
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data as Profile
}

export async function listDriverLocations(): Promise<DriverLocation[]> {
  const { data, error } = await supabase
    .from('driver_locations')
    .select(
      '*, driver:profiles!driver_locations_driver_id_fkey(full_name)',
    )
    .order('updated_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as DriverLocation[]
}

export async function upsertDriverLocation(
  driverId: string,
  latitude: number,
  longitude: number,
): Promise<void> {
  const { error } = await supabase.from('driver_locations').upsert(
    {
      driver_id: driverId,
      latitude,
      longitude,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'driver_id' },
  )

  if (error) throw new Error(error.message)
}
