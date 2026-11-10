import { useCallback, useEffect, useState } from 'react'
import type { Order, StationSettings } from '../types'
import { listAvailableOrders, listDriverOrders } from '../services/orders'
import { getStationSettings } from '../services/settings'
import { getErrorMessage } from '../utils/errors'
import { useRealtimeRefresh } from './useRealtimeRefresh'

const REFRESH_INTERVAL_MS = 30_000

/**
 * Shared driver data for the Pending Orders and Active Route pages.
 * Refreshes on realtime order changes and gently polls so unclaimed orders
 * stay accurate when another driver claims one.
 */
export function useDriverOrders(driverId: string | undefined) {
  const [orders, setOrders] = useState<Order[]>([])
  const [availableOrders, setAvailableOrders] = useState<Order[]>([])
  const [station, setStation] = useState<StationSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (silent = false) => {
      if (!driverId) {
        setLoading(false)
        return
      }
      if (!silent) setLoading(true)
      setError(null)
      try {
        const [nextOrders, nextStation, nextAvailable] = await Promise.all([
          listDriverOrders(driverId),
          getStationSettings(),
          listAvailableOrders(),
        ])
        setOrders(nextOrders)
        setStation(nextStation)
        setAvailableOrders(nextAvailable)
      } catch (loadError) {
        setError(getErrorMessage(loadError))
      } finally {
        setLoading(false)
      }
    },
    [driverId],
  )

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const interval = window.setInterval(
      () => void load(true),
      REFRESH_INTERVAL_MS,
    )
    return () => window.clearInterval(interval)
  }, [load])

  useRealtimeRefresh('orders', () => void load(true))

  return {
    orders,
    setOrders,
    availableOrders,
    setAvailableOrders,
    station,
    loading,
    error,
    load,
  }
}
