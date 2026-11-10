import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getPublicConfig,
  type PublicConfig,
} from '../services/settings'
import { isSupabaseConfigured } from '../services/supabase'
import { getErrorMessage } from '../utils/errors'

export function usePublicConfig() {
  const [config, setConfig] = useState<PublicConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const requestId = useRef(0)

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      setError(
        'Supabase is not configured yet. Add your project URL and anon key to .env and restart the app.',
      )
      return
    }

    const currentRequest = ++requestId.current
    setLoading(true)
    setError(null)
    try {
      const next = await getPublicConfig()
      if (currentRequest === requestId.current) setConfig(next)
    } catch (loadError) {
      if (currentRequest === requestId.current) {
        setError(getErrorMessage(loadError))
      }
    } finally {
      if (currentRequest === requestId.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return { config, loading, error, reload: load, setConfig }
}
