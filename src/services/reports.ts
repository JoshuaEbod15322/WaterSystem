import type { OrderWithRelations } from '../types'
import { supabase } from './supabase'

export interface OrderCounts {
  total: number
  pending: number
  active: number
  completed: number
  cancelled: number
}

export async function getOrderCounts(): Promise<OrderCounts> {
  const [total, pending, active, completed, cancelled] = await Promise.all([
    supabase.from('orders').select('id', { count: 'exact', head: true }),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('order_status', 'pending'),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('order_status', 'out_for_delivery'),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('order_status', 'delivered'),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('order_status', 'cancelled'),
  ])

  const firstError =
    total.error ??
    pending.error ??
    active.error ??
    completed.error ??
    cancelled.error
  if (firstError) throw new Error(firstError.message)

  return {
    total: total.count ?? 0,
    pending: pending.count ?? 0,
    active: active.count ?? 0,
    completed: completed.count ?? 0,
    cancelled: cancelled.count ?? 0,
  }
}

export async function getProfileCounts(): Promise<{
  customers: number
  drivers: number
}> {
  const [customers, drivers] = await Promise.all([
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'customer'),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'driver'),
  ])

  if (customers.error) throw new Error(customers.error.message)
  if (drivers.error) throw new Error(drivers.error.message)

  return {
    customers: customers.count ?? 0,
    drivers: drivers.count ?? 0,
  }
}

export interface PaidSale {
  amount: number
  paid_at: string
}

/**
 * Every settled payment with the moment it was paid. Sales are recognised at
 * payment time (online checkout or cash collected on delivery), not when the
 * order status changes.
 */
export async function getPaidSales(): Promise<PaidSale[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('amount, paid_at')
    .eq('status', 'paid')
    .not('paid_at', 'is', null)
    .order('paid_at', { ascending: true })
    .limit(5000)

  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => ({
    amount: Number(row.amount ?? 0),
    paid_at: String(row.paid_at),
  }))
}

export async function getPaidSalesTotal(): Promise<number> {
  const sales = await getPaidSales()
  return sales.reduce((sum, sale) => sum + sale.amount, 0)
}

export async function getAllOrdersForReports(): Promise<OrderWithRelations[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(
      '*, customer:profiles!orders_customer_id_fkey(id,full_name,email,phone), driver:profiles!orders_driver_id_fkey(id,full_name,email,phone), payments(*)',
    )
    .order('created_at', { ascending: false })
    .limit(2000)

  if (error) throw new Error(error.message)
  return (data ?? []) as OrderWithRelations[]
}
