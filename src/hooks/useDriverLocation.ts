import { useCallback, useEffect, useRef, useState } from 'react'
import type { LatLng } from '../types'
import {
  watchBrowserLocation,
  type BrowserLocationError,
} from '../services/maps'
import { upsertDriverLocation } from '../services/drivers'

const LOCATION_SAVE_INTERVAL_MS = 30_000

export type DriverLocationStatus =
  | 'idle'
  | 'requesting'
  | 'active'
  | 'denied'
  | 'error'

/**
 * Watches the driver's GPS position only after they explicitly enable it.
 * While sharing, a throttled copy is stored in Supabase so dispatchers have a
 * recent position. No continuous GPS history is stored.
 */
export function useDriverLocation(driverId: string | undefined) {
  const [position, setPosition] = useState<LatLng | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<DriverLocationStatus>('idle')
  const stopRef = useRef<(() => void) | null>(null)

  const stop = useCallback(() => {
    stopRef.current?.()
    stopRef.current = null
    setStatus('idle')
    setError(null)
  }, [])

  const start = useCallback(() => {
    if (!driverId) {
      setError('Your driver profile is still loading. Please try again.')
      setStatus('error')
      return
    }

    // Already sharing or waiting for permission.
    if (stopRef.current) return

    setError(null)
    setStatus('requesting')

    let lastSavedAt = 0
    let stopWatch: (() => void) | null = null
    let stopped = false

    function clearWatch() {
      stopped = true
      stopWatch?.()
      stopWatch = null
      if (stopRef.current === clearWatch) stopRef.current = null
    }

    const onUpdate = (point: LatLng) => {
      setPosition(point)
      setError(null)
      setStatus('active')

      const now = Date.now()
      if (now - lastSavedAt >= LOCATION_SAVE_INTERVAL_MS) {
        lastSavedAt = now
        void upsertDriverLocation(driverId, point.lat, point.lng).catch(() => {
          // Location sharing is best-effort; delivery updates still work.
        })
      }
    }

    const onError = (locationError: BrowserLocationError) => {
      setError(locationError.message)
      setStatus(locationError.code === 'denied' ? 'denied' : 'error')
      clearWatch()
    }

    stopWatch = watchBrowserLocation(onUpdate, onError)

    // The browser may report an error synchronously (e.g. unsupported device).
    if (stopped) {
      stopWatch()
      stopWatch = null
      return
    }

    stopRef.current = clearWatch
  }, [driverId])

  useEffect(
    () => () => {
      stopRef.current?.()
      stopRef.current = null
    },
    [],
  )

  return {
    position,
    error,
    status,
    active: status === 'active',
    start,
    stop,
  }
}
