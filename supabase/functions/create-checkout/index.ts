// Creates a Stripe Embedded Checkout session for one order.
// The amount always comes from the database, never from the browser.

import { createClient } from 'npm:@supabase/supabase-js@2'
import Stripe from 'npm:stripe@17'
import { corsHeaders, json } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
  const siteUrl = Deno.env.get('SITE_URL') ?? 'http://localhost:5173'

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !stripeSecretKey) {
    return json({ error: 'Payment environment is not configured.' }, 500)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return json({ error: 'Missing authorization header.' }, 401)
  }

  try {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userError } =
      await userClient.auth.getUser()

    if (userError || !userData.user) {
      return json({ error: 'Your session is invalid or has expired.' }, 401)
    }

    const body = await req.json().catch(() => null)
    const orderId = String(body?.order_id ?? '').trim()

    if (!orderId) {
      return json({ error: 'An order id is required.' }, 400)
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Only the owning customer may pay for this order.
    const { data: order, error: orderError } = await adminClient
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('customer_id', userData.user.id)
      .single()

    if (orderError || !order) {
      return json({ error: 'Order not found.' }, 404)
    }

    if (order.order_status === 'cancelled') {
      return json({ error: 'Cancelled orders cannot be paid.' }, 400)
    }

    if (order.payment_method !== 'stripe') {
      return json(
        { error: 'This order is set to Cash on Delivery.' },
        400,
      )
    }

    if (order.payment_status === 'paid') {
      return json({ error: 'This order has already been paid.' }, 400)
    }

    const amountCentavos = Math.round(Number(order.total_amount) * 100)
    if (!Number.isFinite(amountCentavos) || amountCentavos <= 0) {
      return json({ error: 'The order total is invalid.' }, 400)
    }

    const stripe = new Stripe(stripeSecretKey)

    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded',
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: userData.user.email ?? undefined,
      client_reference_id: order.id,
      metadata: { order_id: order.id, order_code: order.order_code },
      payment_intent_data: {
        metadata: { order_id: order.id, order_code: order.order_code },
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'php',
            unit_amount: amountCentavos,
            product_data: {
              name: `Order ${order.order_code} — 19L Purified Water`,
              description: `${order.water_quantity} container(s) • ${
                order.container_type === 'new'
                  ? 'new container purchase'
                  : 'empty container exchange'
              } • delivery included`,
            },
          },
        },
      ],
      return_url:
        `${siteUrl.replace(/\/$/, '')}/customer/orders/${order.id}` +
        '?payment=verifying',
    })

    if (!session.client_secret) {
      return json(
        { error: 'Stripe did not return a checkout secret.' },
        500,
      )
    }

    // Store the session reference for the webhook + admin monitoring.
    const { error: paymentError } = await adminClient
      .from('payments')
      .update({
        stripe_checkout_session_id: session.id,
        amount: order.total_amount,
        currency: 'PHP',
      })
      .eq('order_id', order.id)

    if (paymentError) {
      console.error('Could not store checkout session', paymentError)
      return json(
        { error: 'The payment record could not be prepared.' },
        500,
      )
    }

    return json({ clientSecret: session.client_secret })
  } catch (error) {
    console.error('create-checkout failed', error)
    const message =
      error instanceof Error ? error.message : 'Unexpected server error.'
    return json({ error: message }, 500)
  }
})
