// Stripe webhook endpoint.
// - Verifies the Stripe signature against the raw request body.
// - Confirms the amount, currency and payment status before marking paid.
// - Is idempotent: each Stripe event is processed at most once.

import { createClient } from 'npm:@supabase/supabase-js@2'
import Stripe from 'npm:stripe@17'

const RELEVANT_EVENTS = new Set([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
])

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!stripeSecretKey || !webhookSecret || !supabaseUrl || !serviceRoleKey) {
    console.error('Stripe webhook environment is not configured')
    return new Response('Webhook is not configured', { status: 500 })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return new Response('Missing Stripe signature', { status: 400 })
  }

  const rawBody = await req.text()
  const stripe = new Stripe(stripeSecretKey)

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      webhookSecret,
    )
  } catch (error) {
    console.error('Invalid Stripe signature', error)
    return new Response('Invalid signature', { status: 400 })
  }

  if (!RELEVANT_EVENTS.has(event.type)) {
    // Acknowledge events we do not need so Stripe stops retrying them.
    return Response.json({ received: true, ignored: event.type })
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    const session = event.data.object as Stripe.Checkout.Session
    const orderId = session.metadata?.order_id ?? session.client_reference_id

    if (!orderId) {
      console.error('Stripe session without an order id', session.id)
      return Response.json({ received: true, ignored: 'missing order id' })
    }

    // Never mark unpaid / incomplete sessions as paid.
    if (session.payment_status !== 'paid') {
      return Response.json({ received: true, ignored: 'not paid yet' })
    }

    if ((session.currency ?? '').toLowerCase() !== 'php') {
      console.error('Unexpected currency', session.currency)
      return Response.json({ received: true, ignored: 'currency mismatch' })
    }

    // Idempotency is checked after loading the order: if a previous attempt
    // stored the event id but failed to update the order, we still need to
    // finish the job instead of silently acknowledging the retry.
    const { data: order, error: orderError } = await adminClient
      .from('orders')
      .select('id, total_amount, payment_status, payment_method')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      console.error('Order not found for Stripe session', orderId)
      // Return 200: retrying will not make the order appear.
      return Response.json({ received: true, ignored: 'order not found' })
    }

    if (order.payment_status === 'paid') {
      return Response.json({ received: true, duplicate: true })
    }

    const { data: alreadyProcessed } = await adminClient
      .from('payments')
      .select('id, status')
      .eq('stripe_event_id', event.id)
      .maybeSingle()

    if (alreadyProcessed && alreadyProcessed.status === 'paid') {
      // Payment row already updated by an earlier attempt; make sure the order
      // row catches up before acknowledging.
      await adminClient
        .from('orders')
        .update({ payment_status: 'paid' })
        .eq('id', order.id)
      return Response.json({ received: true, duplicate: true })
    }

    const expectedAmount = Math.round(Number(order.total_amount) * 100)
    if (session.amount_total !== expectedAmount) {
      console.error('Amount mismatch', {
        expectedAmount,
        received: session.amount_total,
        orderId,
      })
      return new Response('Amount mismatch', { status: 400 })
    }

    if (order.payment_method !== 'stripe') {
      return Response.json({ received: true, ignored: 'not a Stripe order' })
    }

    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id ?? null

    const { error: paymentError } = await adminClient
      .from('payments')
      .update({
        status: 'paid',
        amount: Number(order.total_amount),
        currency: 'PHP',
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: paymentIntentId,
        stripe_event_id: event.id,
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('order_id', order.id)

    if (paymentError) {
      console.error('Could not update payment', paymentError)
      return new Response('Database error', { status: 500 })
    }

    const { error: orderUpdateError } = await adminClient
      .from('orders')
      .update({ payment_status: 'paid', updated_at: new Date().toISOString() })
      .eq('id', order.id)

    if (orderUpdateError) {
      console.error('Could not update order payment status', orderUpdateError)
      return new Response('Database error', { status: 500 })
    }

    return Response.json({ received: true })
  } catch (error) {
    console.error('Stripe webhook failed', error)
    return new Response('Webhook handler error', { status: 500 })
  }
})
