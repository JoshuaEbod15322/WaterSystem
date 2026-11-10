import type {
  ContainerType,
  DeliveryHistoryEntry,
  Order,
  OrderStatus,
  OrderWithRelations,
  PaymentMethod,
} from '../types'
import { supabase } from './supabase'

export interface CreateOrderInput {
  customerId: string
  deliveryDate: string
  deliveryScheduleId: number
  deliveryAddress: string
  deliveryLatitude: number
  deliveryLongitude: number
  deliveryInstructions: string | null
  waterQuantity: number
  containerType: ContainerType
  deliveryDistanceKm: number
  paymentMethod: PaymentMethod
}

/**
 * Inserts the order. Prices, totals, minimum quantity, schedule capacity and
 * the delivery window are all recalculated by database triggers.
 */
export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const { data, error } = await supabase
    .from('orders')
    .insert({
      customer_id: input.customerId,
      delivery_date: input.deliveryDate,
      delivery_schedule_id: input.deliveryScheduleId,
      delivery_address: input.deliveryAddress,
      delivery_latitude: input.deliveryLatitude,
      delivery_longitude: input.deliveryLongitude,
      delivery_instructions: input.deliveryInstructions || null,
      water_quantity: input.waterQuantity,
      container_type: input.containerType,
      delivery_distance_km: input.deliveryDistanceKm,
      payment_method: input.paymentMethod,
    })
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data as Order
}

export async function getOrderById(id: string): Promise<Order> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw new Error(error.message)
  return data as Order
}

export async function getOrderWithRelations(
  id: string,
): Promise<OrderWithRelations> {
  const { data, error } = await supabase
    .from('orders')
    .select(
      '*, customer:profiles!orders_customer_id_fkey(id,full_name,email,phone), driver:profiles!orders_driver_id_fkey(id,full_name,email,phone), payments(*)',
    )
    .eq('id', id)
    .single()

  if (error) throw new Error(error.message)

  const order = data as OrderWithRelations
  if (Array.isArray(order.payments)) {
    order.payments.sort((a, b) => a.created_at.localeCompare(b.created_at))
  }
  return order
}

export async function listCustomerOrders(
  customerId: string,
): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as Order[]
}

export async function listDriverOrders(driverId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('driver_id', driverId)
    .order('delivery_date', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as Order[]
}

/**
 * Pending, unassigned deliveries that any active driver may claim. RLS enforces
 * the same restrictions. Orders are ordered by schedule so the earliest
 * delivery is always on top.
 */
export async function listAvailableOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('order_status', 'pending')
    .is('driver_id', null)
    .order('delivery_date', { ascending: true })
    .order('delivery_time', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as Order[]
}

/**
 * Atomically claims a pending order. The RPC sets the driver and moves the
 * order straight to `out_for_delivery`; a second driver gets an error.
 */
export async function acceptOrder(orderId: string): Promise<Order> {
  const { data, error } = await supabase.rpc('accept_order', {
    p_order_id: orderId,
  })

  if (error) throw new Error(error.message)
  return data as Order
}

export interface AdminOrderFilters {
  status?: OrderStatus | 'all'
  search?: string
  date?: string
  driverId?: string
  customerId?: string
}

export async function listAdminOrders(
  filters: AdminOrderFilters = {},
): Promise<OrderWithRelations[]> {
  let query = supabase
    .from('orders')
    .select(
      '*, customer:profiles!orders_customer_id_fkey(id,full_name,email,phone), driver:profiles!orders_driver_id_fkey(id,full_name,email,phone)',
    )
    .order('created_at', { ascending: false })
    .limit(300)

  if (filters.status && filters.status !== 'all') {
    query = query.eq('order_status', filters.status)
  }
  if (filters.date) {
    query = query.eq('delivery_date', filters.date)
  }
  if (filters.driverId) {
    query = query.eq('driver_id', filters.driverId)
  }
  if (filters.customerId) {
    query = query.eq('customer_id', filters.customerId)
  }
  if (filters.search?.trim()) {
    const term = filters.search.trim()
    query = query.or(
      `order_code.ilike.%${term}%,customer_name.ilike.%${term}%,delivery_address.ilike.%${term}%`,
    )
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as OrderWithRelations[]
}

export async function updateOrderStatus(
  orderId: string,
  orderStatus: OrderStatus,
): Promise<Order> {
  const { data, error } = await supabase
    .from('orders')
    .update({ order_status: orderStatus })
    .eq('id', orderId)
    .select('*')
    .single()

  if (error) throw new Error(error.message)
  return data as Order
}

export async function cancelOrder(orderId: string): Promise<Order> {
  const { data, error } = await supabase.rpc('cancel_order', {
    p_order_id: orderId,
  })

  if (error) throw new Error(error.message)
  return data as Order
}

export async function getOrderHistory(
  orderId: string,
): Promise<DeliveryHistoryEntry[]> {
  const { data, error } = await supabase
    .from('delivery_history')
    .select('*, driver:profiles(full_name)')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as DeliveryHistoryEntry[]
}

export async function getRecentDeliveryHistory(
  limit = 8,
): Promise<DeliveryHistoryEntry[]> {
  const { data, error } = await supabase
    .from('delivery_history')
    .select('*, driver:profiles(full_name), order:orders(order_code)')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)
  return (data ?? []) as DeliveryHistoryEntry[]
}

export async function markCashPaymentPaid(orderId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_order_paid', {
    p_order_id: orderId,
  })
  if (error) throw new Error(error.message)
}
