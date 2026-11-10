import type { Order, Payment } from '../types'
import { supabase } from './supabase'

/**
 * Settles the simulated card payment for a pending order.
 *
 * The payment screen is a demo card form: it validates the fields in the
 * browser, sends no card data anywhere, and asks the database to mark the
 * order paid. The underlying Stripe Edge Functions are kept for a future
 * real PaymentIntent integration.
 */
export async function completeCardPayment(orderId: string): Promise<Order> {
  const { data, error } = await supabase.rpc('complete_demo_card_payment', {
    p_order_id: orderId,
  })

  if (error) throw new Error(error.message)
  return data as Order
}

export async function getPaymentForOrder(
  orderId: string,
): Promise<Payment | null> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('order_id', orderId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return (data as Payment | null) ?? null
}
