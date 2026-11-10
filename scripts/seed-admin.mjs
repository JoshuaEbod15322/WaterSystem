// Creates (or repairs) the AquaDrop administrator account.
//
// Usage:
//   1. Put SUPABASE_SERVICE_ROLE_KEY in .env.local (never commit it).
//   2. Run: npm run seed:admin
//
// The service-role key is only used by this Node script. It is never exposed
// to the Vite browser bundle because it has no VITE_ prefix.

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = 'admin@gmail.com'
const ADMIN_PASSWORD = 'admin123'
const ADMIN_NAME = 'Administrator'

function loadEnvFile(path) {
  if (!existsSync(path)) return

  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const separator = trimmed.indexOf('=')
    if (separator < 0) continue

    const key = trimmed.slice(0, separator).trim()
    let value = trimmed.slice(separator + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (!process.env[key]) process.env[key] = value
  }
}

loadEnvFile(resolve(process.cwd(), '.env.local'))
loadEnvFile(resolve(process.cwd(), '.env'))

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    'Missing configuration. Add VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local.',
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function findUserIdByEmail(email) {
  let page = 1

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    })

    if (error) throw error

    const match = data.users.find(
      (user) => user.email?.toLowerCase() === email.toLowerCase(),
    )
    if (match) return match.id
    if (data.users.length < 200) return null

    page += 1
  }
}

async function main() {
  let userId = await findUserIdByEmail(ADMIN_EMAIL)

  if (userId) {
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: ADMIN_NAME },
    })

    if (error) throw error
    console.log(`Updated existing Auth user (${userId}).`)
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: ADMIN_NAME },
    })

    if (error) throw error
    userId = data.user.id
    console.log(`Created Auth user (${userId}).`)
  }

  // The on_auth_user_created trigger creates the profile row. Give it a
  // moment to commit before updating the role.
  let profile = null
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    if (data) {
      profile = data
      break
    }

    await new Promise((resolve) => setTimeout(resolve, 300))
  }

  if (!profile) {
    throw new Error('The Auth user exists but its profile row was not created.')
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      full_name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      role: 'admin',
      is_active: true,
    })
    .eq('id', userId)

  if (profileError) throw profileError

  console.log('')
  console.log('Administrator account is ready.')
  console.log(`  Email:    ${ADMIN_EMAIL}`)
  console.log(`  Password: ${ADMIN_PASSWORD}`)
}

main().catch((error) => {
  console.error('Could not seed the administrator account:')
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
