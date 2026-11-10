import type { FunctionsHttpError } from '@supabase/supabase-js'

export function getErrorMessage(error: unknown): string {
  if (!error) return 'Something went wrong. Please try again.'
  if (typeof error === 'string') return error
  if (error instanceof Error) {
    if (error.message.includes('Failed to fetch')) {
      return 'Unable to reach the server. Check your connection and try again.'
    }
    return error.message
  }
  if (typeof error === 'object' && error !== null) {
    const record = error as Record<string, unknown>
    if (typeof record.message === 'string') return record.message
    if (typeof record.error_description === 'string') return record.error_description
    if (typeof record.details === 'string') return record.details
    if (typeof record.error === 'string') return record.error
  }
  return 'Something went wrong. Please try again.'
}

/**
 * Supabase Edge Functions return their error payload inside a Response.
 * This helper pulls the readable message out of that response.
 */
export async function getEdgeFunctionError(
  error: FunctionsHttpError | null,
): Promise<string> {
  if (!error) return 'The request could not be completed.'
  try {
    const payload = await error.context.json()
    if (payload && typeof payload.error === 'string') return payload.error
    if (payload && typeof payload.message === 'string') return payload.message
  } catch {
    // Fall through to the generic message.
  }
  return error.message || 'The request could not be completed.'
}
