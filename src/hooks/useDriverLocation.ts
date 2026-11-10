import { useEffect, useState } from 'react'
import type { LatLng } from '../types'
import { watchBrowserLocation } from '../services/maps'
import { upsertDriverLocation } from '../services/drivers'

const LOCATION_SAVE_INTERVAL_MS = 30_000

/**
 * Watches the driver's GPS position and stores a throttled copy in Supabase
 * so dispatchers have a recent position. No continuous GPS history is stored.
 */
export function useDriverLocation(driverId: string | undefined) {
  const [position, setPosition] = useState<LatLng | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (!driverId) return

    setActive(true)
    let lastSavedAt = 0

    const stop = watchBrowserLocation(
      (point) => {
        setPosition(point)
        setError(null)
        const now = Date.now()
        if (now - lastSavedAt >= LOCATION_SAVE_INTERVAL_MS) {
          lastSavedAt = now
          void upsertDriverLocation(driverId, point.lat, point.lng).catch(
            () => {
              // Location sharing is best-effort; delivery updates still work.
            },
          )
        }
      },
      (locationError) => {
        setError(locationError.message)
        setActive(false)
      },
    )

    return stop
  }, [driverId])

  return { position, error, active }
}
