import { DatabaseZap } from 'lucide-react'
import { isSupabaseConfigured } from '../../services/supabase'

export function SetupNotice() {
  if (isSupabaseConfigured) return null

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-amber-900">
      <div className="mx-auto flex max-w-7xl items-start gap-2.5 text-xs sm:text-sm">
        <DatabaseZap className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          <span className="font-semibold">Setup required.</span> Add your
          Supabase URL, anon key and Stripe publishable key to{' '}
          <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[11px]">
            .env
          </code>
          , then restart the development server. See the README for the full
          guide.
        </p>
      </div>
    </div>
  )
}
