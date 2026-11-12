import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Clock,
  MapPin,
  Navigation,
  Route as RouteIcon,
  Truck,
} from 'lucide-react'
import type {
  DriverLocation,
  LatLng,
  OrderWithRelations,
  Profile,
  StationSettings,
} from '../../types'
import { listAdminOrders } from '../../services/orders'
import {
  listDriverLocations,
  listDrivers,
} from '../../services/drivers'
import { getStationSettings } from '../../services/settings'
import {
  getOptimizedRoute,
  type OptimizedRoute,
} from '../../services/maps'
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh'
import { getErrorMessage } from '../../utils/errors'
import { formatDeliveryDate } from '../../utils/dates'
import {
  Alert,
  Card,
  EmptyState,
  PageHeader,
  Spinner,
} from '../../components/common/ui'
import { OrderStatusBadge } from '../../components/common/StatusBadges'
import {
  RouteMap,
  type RouteMapDestination,
  type RouteMapLine,
} from '../../components/common/RouteMap'

const ACTIVE_STATUSES = new Set(['out_for_delivery'])

export function AdminRoutesPage() {
  const [drivers, setDrivers] = useState<Profile[]>([])
  const [orders, setOrders] = useState<OrderWithRelations[]>([])
  const [locations, setLocations] = useState<DriverLocation[]>([])
  const [station, setStation] = useState<StationSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      const [nextDrivers, nextOrders, nextLocations, nextStation] =
        await Promise.all([
          listDrivers(),
          listAdminOrders({ status: 'all' }),
          listDriverLocations(),
          getStationSettings(),
        ])
      setDrivers(nextDrivers)
      setOrders(nextOrders)
      setLocations(nextLocations)
      setStation(nextStation)
    } catch (loadError) {
      setError(getErrorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useRealtimeRefresh('orders', () => void load(true))
  useRealtimeRefresh('driver_locations', () => void load(true))

  const activeOrders = useMemo(
    () =>
      orders
        .filter((order) => ACTIVE_STATUSES.has(order.order_status))
        .sort((a, b) =>
          `${a.delivery_date}${a.delivery_time}`.localeCompare(
            `${b.delivery_date}${b.delivery_time}`,
          ),
        ),
    [orders],
  )

  const ordersByDriver = useMemo(() => {
    const map = new Map<string, OrderWithRelations[]>()
    activeOrders.forEach((order) => {
      if (!order.driver_id) return
      const current = map.get(order.driver_id) ?? []
      current.push(order)
      map.set(order.driver_id, current)
    })
    return map
  }, [activeOrders])

  const driversWithStops = useMemo(
    () =>
      drivers
        .map((driver) => ({
          driver,
          orders: ordersByDriver.get(driver.id) ?? [],
        }))
        .filter((entry) => entry.orders.length > 0),
    [drivers, ordersByDriver],
  )

  const pendingOrders = useMemo(
    () =>
      orders.filter(
        (order) => order.order_status === 'pending' && !order.driver_id,
      ),
    [orders],
  )

  const selected =
    driversWithStops.find((entry) => entry.driver.id === selectedDriverId) ??
    driversWithStops[0] ??
    null

  const locationByDriver = useMemo(() => {
    const map = new Map<string, DriverLocation>()
    locations.forEach((location) => map.set(location.driver_id, location))
    return map
  }, [locations])

  const stationPoint = station
    ? { lat: station.latitude, lng: station.longitude }
    : null

  const selectedLocation = selected
    ? locationByDriver.get(selected.driver.id)
    : null
  const driverPoint: LatLng | null = selectedLocation
    ? {
        lat: Number(selectedLocation.latitude),
        lng: Number(selectedLocation.longitude),
      }
    : null
  const origin = driverPoint ?? stationPoint

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Dispatch"
        title="Route planner"
        description="See each driver's active stops in the recommended visit order, with total distance and driving time."
      />

      {error ? (
        <Alert tone="error" title="Could not load routes">
          {error}
        </Alert>
      ) : null}

      {loading && orders.length === 0 ? (
        <Spinner label="Loading delivery routes…" />
      ) : driversWithStops.length === 0 ? (
        <EmptyState
          icon={RouteIcon}
          title="No active routes"
          description="Routes appear here once a driver accepts a pending delivery and starts the trip."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <div className="space-y-2">
            <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Drivers on the road
            </h2>
            {driversWithStops.map(({ driver, orders: driverOrders }) => {
              const isActive = selected?.driver.id === driver.id
              const cash = driverOrders
                .filter(
                  (order) =>
                    order.payment_method === 'cod' &&
                    order.payment_status !== 'paid',
                )
                .reduce((sum, order) => sum + Number(order.total_amount), 0)

              return (
                <button
                  key={driver.id}
                  type="button"
                  onClick={() => setSelectedDriverId(driver.id)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    isActive
                      ? 'border-brand-300 bg-brand-50 ring-2 ring-brand-200'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                      {driver.full_name.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {driver.full_name}
                      </p>
                      <p className="truncate text-[11px] text-slate-500">
                        {driver.phone || driver.email}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Truck className="h-3 w-3" />
                      {driverOrders.length} stop
                      {driverOrders.length === 1 ? '' : 's'}
                    </span>
                    {cash > 0 ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                        ₱{cash.toFixed(2)} COD
                      </span>
                    ) : null}
                  </div>
                </button>
              )
            })}
          </div>

          {selected ? (
            <Card className="p-4">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Optimized plan
                  </p>
                  <h2 className="text-base font-bold text-slate-900">
                    {selected.driver.full_name}
                  </h2>
                </div>
                {selectedLocation ? (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200">
                    <Navigation className="h-3.5 w-3.5" />
                    Live GPS position
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600">
                    <MapPin className="h-3.5 w-3.5" />
                    Routing from station
                  </span>
                )}
              </div>

              <RoutePlanMap
                origin={origin}
                driver={driverPoint}
                station={stationPoint}
                orders={selected.orders}
              />
            </Card>
          ) : null}
        </div>
      )}

      {pendingOrders.length > 0 ? (
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-600" />
            <h2 className="text-sm font-semibold text-slate-900">
              Awaiting driver pickup
            </h2>
            <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
              {pendingOrders.length}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Pending unassigned orders that active drivers can accept from their
            own dashboard.
          </p>
          <ul className="mt-3 divide-y divide-slate-100">
            {pendingOrders.slice(0, 8).map((order) => (
              <li
                key={order.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-xs"
              >
                <Link
                  to={`/admin/orders/${order.id}`}
                  className="font-semibold text-brand-700 hover:underline"
                >
                  {order.order_code}
                </Link>
                <span className="text-slate-500">{order.customer_name}</span>
                <span className="inline-flex items-center gap-1 text-slate-500">
                  <MapPin className="h-3 w-3" />
                  <span className="line-clamp-1 max-w-[260px]">
                    {order.delivery_address}
                  </span>
                </span>
                <span className="ml-auto text-slate-400">
                  {formatDeliveryDate(order.delivery_date)} · {order.delivery_time}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  )
}

function RoutePlanMap({
  origin,
  driver,
  station,
  orders,
}: {
  origin: LatLng | null
  driver: LatLng | null
  station: LatLng | null
  orders: OrderWithRelations[]
}) {
  const [optimized, setOptimized] = useState<OptimizedRoute | null>(null)
  const [routing, setRouting] = useState(false)
  const [routingError, setRoutingError] = useState<string | null>(null)

  const originLat = origin?.lat
  const originLng = origin?.lng
  const stableOrigin = useMemo<LatLng | null>(() => {
    if (originLat === undefined || originLng === undefined) return null
    return {
      lat: Math.round(originLat * 1000) / 1000,
      lng: Math.round(originLng * 1000) / 1000,
    }
  }, [originLat, originLng])

  const stops = useMemo(
    () =>
      orders.map((order) => ({
        id: order.id,
        point: {
          lat: Number(order.delivery_latitude),
          lng: Number(order.delivery_longitude),
        },
      })),
    [orders],
  )

  useEffect(() => {
    if (!stableOrigin || stops.length === 0) {
      setOptimized(null)
      setRouting(false)
      setRoutingError(null)
      return
    }

    let cancelled = false
    const controller = new AbortController()
    setRouting(true)
    setRoutingError(null)

    getOptimizedRoute(stableOrigin, stops, controller.signal)
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
  }, [stableOrigin, stops])

  const destinations = useMemo<RouteMapDestination[]>(
    () =>
      orders.map((order) => ({
        id: order.id,
        label: `${order.order_code} · ${order.customer_name}`,
        status: order.order_status,
        lat: Number(order.delivery_latitude),
        lng: Number(order.delivery_longitude),
      })),
    [orders],
  )

  const routes = useMemo<RouteMapLine[]>(
    () =>
      optimized
        ? [{ id: 'optimized', coordinates: optimized.coordinates }]
        : [],
    [optimized],
  )

  return (
    <div className="space-y-3">
      <RouteMap
        station={station}
        driver={driver}
        destinations={destinations}
        routes={routes}
        heightClass="h-80"
      />

      {routing ? (
        <p className="inline-flex items-center gap-1.5 text-xs text-slate-500">
          <RouteIcon className="h-3.5 w-3.5 animate-pulse" />
          Optimizing the stop order…
        </p>
      ) : optimized ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
          <RouteIcon className="h-4 w-4" />
          <span>{optimized.distanceKm} km total</span>
          <span className="text-emerald-300">·</span>
          <span>~{optimized.durationMinutes} min driving</span>
          <span className="ml-auto text-[11px] font-medium text-emerald-700">
            {optimized.stops.length} stop
            {optimized.stops.length === 1 ? '' : 's'}
          </span>
        </div>
      ) : routingError ? (
        <p className="text-xs text-amber-700">
          The optimized route could not be drawn ({routingError}). Stop details
          below are still valid.
        </p>
      ) : null}

      <ol className="space-y-2">
        {(optimized?.stops ?? []).map((stop) => {
          const order = orders.find((item) => item.id === stop.id)
          if (!order) return null
          return (
            <li
              key={stop.id}
              className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5"
            >
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                {stop.sequence}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to={`/admin/orders/${order.id}`}
                    className="text-sm font-semibold text-slate-900 hover:text-brand-700"
                  >
                    {order.order_code}
                  </Link>
                  <OrderStatusBadge status={order.order_status} />
                  <span className="text-[11px] text-slate-400">
                    {stop.distanceKm} km · ~{stop.durationMinutes} min
                  </span>
                </div>
                <p className="mt-1 flex items-start gap-1.5 text-xs text-slate-500">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="line-clamp-2">{order.delivery_address}</span>
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  {order.customer_name} · {order.delivery_time} ·{' '}
                  {order.water_quantity} × 19L
                </p>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
