export type UserRole = 'admin' | 'driver' | 'customer'

export type OrderStatus =
  | 'pending'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'

export type ContainerType = 'exchange' | 'new'

export type PaymentMethod = 'stripe' | 'cod'

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'

export type PaymentProvider = 'stripe' | 'cod'

export interface Profile {
  id: string
  full_name: string
  email: string
  phone: string | null
  role: UserRole
  is_active: boolean
  address: string | null
  latitude: number | null
  longitude: number | null
  created_at: string
  updated_at: string
}

export interface StationSettings {
  id: number
  station_name: string
  address: string
  latitude: number
  longitude: number
  contact_number: string
  operating_hours: string
  max_delivery_distance_km: number
  updated_at: string
}

export interface PricingSettings {
  id: number
  water_price: number
  container_price: number
  delivery_fee: number
  updated_at: string
}

export interface DistancePricingRule {
  id: number
  min_km: number
  max_km: number | null
  min_quantity: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DeliverySchedule {
  id: number
  day_of_week: number
  start_time: string
  end_time: string
  max_orders: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Order {
  id: string
  order_code: string
  customer_id: string
  driver_id: string | null
  order_status: OrderStatus
  delivery_date: string
  delivery_time: string
  delivery_schedule_id: number | null
  delivery_address: string
  delivery_latitude: number
  delivery_longitude: number
  delivery_instructions: string | null
  water_quantity: number
  container_type: ContainerType
  water_price_snapshot: number
  container_price_snapshot: number
  water_subtotal: number
  container_subtotal: number
  delivery_fee: number
  delivery_distance_km: number
  minimum_required_quantity: number
  total_amount: number
  payment_method: PaymentMethod
  payment_status: PaymentStatus
  customer_name: string
  customer_phone: string | null
  created_at: string
  updated_at: string
  delivered_at: string | null
  cancelled_at: string | null
}

export interface OrderWithRelations extends Order {
  customer?: Pick<Profile, 'id' | 'full_name' | 'email' | 'phone'> | null
  driver?: Pick<Profile, 'id' | 'full_name' | 'email' | 'phone'> | null
  payments?: Payment[] | null
}

export interface Payment {
  id: string
  order_id: string
  provider: PaymentProvider
  amount: number
  currency: string
  status: PaymentStatus
  stripe_checkout_session_id: string | null
  stripe_payment_intent_id: string | null
  stripe_event_id: string | null
  paid_at: string | null
  created_at: string
  updated_at: string
}

export interface DeliveryHistoryEntry {
  id: number
  order_id: string
  driver_id: string | null
  status: OrderStatus
  note: string | null
  created_at: string
  driver?: Pick<Profile, 'full_name'> | null
  order?: { order_code: string } | null
}

export interface DriverLocation {
  driver_id: string
  latitude: number
  longitude: number
  updated_at: string
  driver?: Pick<Profile, 'full_name'> | null
}

export interface ScheduleAvailability {
  schedule_id: number
  delivery_date: string
  booked: number
}

export interface LatLng {
  lat: number
  lng: number
}

export interface OrderCalculationInput {
  waterQuantity: number
  containerType: ContainerType
  waterPrice: number
  containerPrice: number
  deliveryFee: number
}
