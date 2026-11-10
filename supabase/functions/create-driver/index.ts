// Creates a driver account securely.
// Only a signed-in, active administrator may call this function.
// The service-role key stays inside the Edge Function runtime.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, json } from '../_shared/cors.ts'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: 'Edge Function environment is not configured.' }, 500)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return json({ error: 'Missing authorization header.' }, 401)
  }

  try {
    // 1. Verify the caller's authentication.
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userError } =
      await userClient.auth.getUser()

    if (userError || !userData.user) {
      return json({ error: 'Your session is invalid or has expired.' }, 401)
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 2. Verify the caller is an active administrator.
    const { data: caller, error: callerError } = await adminClient
      .from('profiles')
      .select('role, is_active')
      .eq('id', userData.user.id)
      .single()

    if (callerError) {
      return json({ error: 'Unable to verify your account.' }, 500)
    }

    if (caller?.role !== 'admin' || !caller.is_active) {
      return json(
        { error: 'Only administrators can create driver accounts.' },
        403,
      )
    }

    // 3. Validate input.
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return json({ error: 'Invalid request body.' }, 400)
    }

    const fullName = String(body.fullName ?? '').trim()
    const email = String(body.email ?? '').trim().toLowerCase()
    const phone = String(body.phone ?? '').trim()
    const password = String(body.password ?? '')

    if (fullName.length < 2) {
      return json({ error: 'Driver name must be at least 2 characters.' }, 400)
    }
    if (!EMAIL_PATTERN.test(email)) {
      return json({ error: 'Enter a valid email address.' }, 400)
    }
    if (password.length < 6) {
      return json(
        { error: 'Password must be at least 6 characters.' },
        400,
      )
    }
    if (phone && !/^[0-9+()\-\s]{7,20}$/.test(phone)) {
      return json({ error: 'Enter a valid contact number.' }, 400)
    }

    // 4. Create the Supabase Auth user. Email is pre-confirmed because only
    //    an administrator can create drivers.
    const { data: created, error: createError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, phone },
      })

    if (createError) {
      const message = createError.message.toLowerCase().includes('registered')
        ? 'An account with this email already exists.'
        : createError.message
      return json({ error: message }, 400)
    }

    if (!created.user) {
      return json({ error: 'The auth account could not be created.' }, 500)
    }

    // 5. Create/upgrade the profile with the driver role.
    const { data: driver, error: profileError } = await adminClient
      .from('profiles')
      .upsert(
        {
          id: created.user.id,
          full_name: fullName,
          email,
          phone: phone || null,
          role: 'driver',
          is_active: true,
        },
        { onConflict: 'id' },
      )
      .select('*')
      .single()

    if (profileError || !driver) {
      // Roll back the auth user so a retry does not hit "email already exists".
      await adminClient.auth.admin.deleteUser(created.user.id)
      return json(
        {
          error:
            profileError?.message ??
            'The driver profile could not be created.',
        },
        500,
      )
    }

    return json({ driver })
  } catch (error) {
    console.error('create-driver failed', error)
    return json({ error: 'Unexpected server error.' }, 500)
  }
})
