import { useEffect, useRef } from 'react'
import { supabase } from '../services/supabase'

/**
 * Subscribes to Postgres changes for a table and calls `onChange`.
 * RLS is applied to realtime, so users only receive rows they may read.
 */
export function useRealtimeRefresh(
  table: string,
  onChange: () => void,
  enabled = true,
) {
  const changeRef = useRef(onChange)
  changeRef.current = onChange

  useEffect(() => {
    if (!enabled) return

    const channel = supabase
      .channel(`realtime-${table}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => changeRef.current(),
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [table, enabled])
}
