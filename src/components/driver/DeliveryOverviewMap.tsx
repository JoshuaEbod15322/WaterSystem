import { useEffect, useMemo, useState } from 'react'
import type { LatLng, Order } from '../../types'
import {
  getOptimizedRoute,
  type OptimizedRoute,
} from '../../services/maps'
import { getErrorMessage } from '../../utils/errors'
import {
  RouteMap,
  type RouteMapDestination,
  type RouteMapLine,
} from '../common/RouteMap'

/**
 * Shows the station, the driver's current GPS position and every active
 * delivery on one optimized multi-stop route. Stops are numbered in the
 * recommended visit order and the total distance/time is shown below the map.
 */
export function DeliveryOverviewMap({
  station,
  driver,
  orders,
  heightClass = 'h-64',
}: {
  station: LatLng | null
  driver: LatLng | null
  orders: Order[]
  heightClass?: string
}) {
  const [optimized, setOptimized] = useState<OptimizedRoute | null>(null)
  const [routing, setRouting] = useState(false)
  const [routingError, setRoutingError] = useState<string | null>(null)

  const originLat = driver?.lat ?? station?.lat
  const originLng = driver?.lng ?? station?.lng

  const origin = useMemo<LatLng | null>(() => {
    if (originLat === undefined || originLng === undefined) return null
    return {
      lat: Math.round(originLat * 1000) / 1000,
      lng: Math.round(originLng * 1000) / 1000,
    }
  }, [originLat, originLng])

  const stops = useMemo(
    () =>
      orders
        .map((order) => ({
          id: order.id,
          point: {
            lat: Number(order.delivery_latitude),
            lng: Number(order.delivery_longitude),
          },
        }))
        .filter(
          (stop) =>
            Number.isFinite(stop.point.lat) && Number.isFinite(stop.point.lng),
        ),
    [orders],
  )

  useEffect(() => {
    if (!origin || stops.length === 0) {
      setOptimized(null)
      setRouting(false)
      setRoutingError(null)
      return
    }

    let cancelled = false
    const controller = new AbortController()
    setRouting(true)
    setRoutingError(null)

    getOptimizedRoute(origin, stops, controller.signal)
      .then((route) => {
        if (cancelled) return
        setOptimized(route)
        setRouting(false)
      })
      .catch((error) => {
        if ((error as Error).name === 'AbortError') return
        if (cancelled) return
        setOptimized(null)
        setRoutingError(getErrorMessage(error))
        setRouting(false)
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [origin, stops])

  const routes = useMemo<RouteMapLine[]>(
    () =>
      optimized
        ? [{ id: 'optimized', coordinates: optimized.coordinates }]
        : [],
    [optimized],
  )

  const destinations = useMemo<RouteMapDestination[]>(() => {
    const sequences = new Map(
      (optimized?.stops ?? []).map((stop) => [stop.id, stop.sequence]),
    )
    return orders.map((order) => ({
      id: order.id,
      label: `${order.order_code} · ${order.customer_name}`,
      status: order.order_status,
      lat: Number(order.delivery_latitude),
      lng: Number(order.delivery_longitude),
      sequence: sequences.get(order.id),
    }))
  }, [orders, optimized])

  const orderedStops = useMemo(() => {
    if (!optimized) return []
    return optimized.stops.flatMap((stop) => {
      const order = orders.find((item) => item.id === stop.id)
      return order ? [{ stop, order }] : []
    })
  }, [optimized, orders])

  return (
    <div className="space-y-2">
      <RouteMap
        station={station}
        driver={driver}
        destinations={destinations}
        routes={routes}
        heightClass={heightClass}
        numberedPins={Boolean(optimized)}
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px] text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-600" />
          Your position
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-teal-700" />
          Station
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-brand-600" />
          Numbered stop
        </span>
        {routing ? <span className="ml-auto">Optimizing route…</span> : null}
      </div>

      {optimized ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
          <span>Optimized route</span>
          <span className="text-emerald-300">·</span>
          <span>{optimized.distanceKm} km total</span>
          <span className="text-emerald-300">·</span>
          <span>~{optimized.durationMinutes} min</span>
          <span className="ml-auto text-[11px] font-medium text-emerald-700">
            {optimized.stops.length} stop
            {optimized.stops.length === 1 ? '' : 's'}
          </span>
        </div>
      ) : null}

      {routingError && !routing ? (
        <p className="px-1 text-[11px] text-amber-700">
          The optimized route could not be drawn right now ({routingError}).
          Order details still work.
        </p>
      ) : null}

      {orderedStops.length > 0 ? (
        <ol className="grid gap-1.5 sm:grid-cols-2">
          {orderedStops.map(({ stop, order }) => (
            <li
              key={stop.id}
              className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-[11px] text-slate-600 ring-1 ring-slate-200"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                {stop.sequence}
              </span>
              <span className="min-w-0 truncate">
                <span className="font-semibold text-slate-800">
                  {order.order_code}
                </span>{' '}
                · {stop.distanceKm} km · ~{stop.durationMinutes} min
              </span>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  )
}
