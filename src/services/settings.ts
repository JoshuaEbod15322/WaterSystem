import type {
  DeliverySchedule,
  DistancePricingRule,
  PricingSettings,
  ScheduleAvailability,
  StationSettings,
} from '../types'
import { supabase } from './supabase'

export async function getStationSettings(): Promise<StationSettings> {
  const { data, error } = await supabase
    .from('station_settings')
    .select('*')
    .eq('id', 1)
    .single()

  if (error) throw new Error(error.message)
  return data as StationSettings
}

export async function getPricingSettings(): Promise<PricingSettings> {
  const { data, error } = await supabase
    .from('pricing_settings')
    .select('*')
    .eq('id', 1)
    .single()

  if (error) throw new Error(error.message)
  return data as PricingSettings
}

export async function getDistanceRules(): Promise<DistancePricingRule[]> {
  const { data, error } = await supabase
    .from('distance_pricing_rules')
    .select('*')
    .order('min_km', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as DistancePricingRule[]
}

export async function getDeliverySchedules(): Promise<DeliverySchedule[]> {
  const { data, error } = await supabase
    .from('delivery_schedules')
    .select('*')
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as DeliverySchedule[]
}

export interface PublicConfig {
  station: StationSettings
  pricing: PricingSettings
  distanceRules: DistancePricingRule[]
  schedules: DeliverySchedule[]
}

export async function getPublicConfig(): Promise<PublicConfig> {
  const [station, pricing, distanceRules, schedules] = await Promise.all([
    getStationSettings(),
    getPricingSettings(),
    getDistanceRules(),
    getDeliverySchedules(),
  ])

  return {
    station,
    pricing,
    distanceRules: distanceRules.filter((rule) => rule.is_active),
    schedules: schedules.filter((schedule) => schedule.is_active),
  }
}

export async function updateStationSettings(
  settings: Omit<StationSettings, 'id' | 'updated_at'>,
): Promise<StationSettings> {
  const { data, error } = await supabase
    .from('station_settings')
    .update(settings)
    .eq('id', 1)
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data as StationSettings
}

export async function updatePricingSettings(
  pricing: Pick<PricingSettings, 'water_price' | 'container_price' | 'delivery_fee'>,
): Promise<PricingSettings> {
  const { data, error } = await supabase
    .from('pricing_settings')
    .update(pricing)
    .eq('id', 1)
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data as PricingSettings
}

export interface DistanceRuleInput {
  min_km: number
  max_km: number | null
  min_quantity: number
  is_active: boolean
}

export async function saveDistanceRule(
  input: DistanceRuleInput,
  id?: number,
): Promise<DistancePricingRule> {
  if (id) {
    const { data, error } = await supabase
      .from('distance_pricing_rules')
      .update(input)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data as DistancePricingRule
  }

  const { data, error } = await supabase
    .from('distance_pricing_rules')
    .insert(input)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as DistancePricingRule
}

export async function setDistanceRuleActive(
  id: number,
  isActive: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('distance_pricing_rules')
    .update({ is_active: isActive })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteDistanceRule(id: number): Promise<void> {
  const { error } = await supabase
    .from('distance_pricing_rules')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export interface ScheduleInput {
  day_of_week: number
  start_time: string
  end_time: string
  max_orders: number
  is_active: boolean
}

export async function saveDeliverySchedule(
  input: ScheduleInput,
  id?: number,
): Promise<DeliverySchedule> {
  const payload = {
    ...input,
    start_time: normalizeTime(input.start_time),
    end_time: normalizeTime(input.end_time),
  }

  if (id) {
    const { data, error } = await supabase
      .from('delivery_schedules')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return data as DeliverySchedule
  }

  const { data, error } = await supabase
    .from('delivery_schedules')
    .insert(payload)
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as DeliverySchedule
}

export async function deleteDeliverySchedule(id: number): Promise<void> {
  const { error } = await supabase
    .from('delivery_schedules')
    .delete()
    .eq('id', id)
  if (error) throw new Error(error.message)
}

function normalizeTime(value: string): string {
  if (value.length === 5) return `${value}:00`
  return value
}

export async function getScheduleAvailability(
  fromDate: string,
  toDate: string,
): Promise<ScheduleAvailability[]> {
  const { data, error } = await supabase.rpc('get_schedule_availability', {
    p_from: fromDate,
    p_to: toDate,
  })

  if (error) throw new Error(error.message)
  return (data ?? []) as ScheduleAvailability[]
}
