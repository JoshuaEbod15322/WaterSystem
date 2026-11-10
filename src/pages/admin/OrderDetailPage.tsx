import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  Truck,
  UserRound,
  XCircle,
} from 'lucide-react'
import type {
  DeliveryHistoryEntry,
  OrderWithRelations,
  StationSettings,
} from '../../types'
import {
  getOrderHistory,
  getOrderWithRelations,
} from '../../services/orders'
import { getStationSettings } from '../../services/settings'
import { getRoadRoute, type RoadRoute } from '../../services/maps'
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh'
import { getErrorMessage } from '../../utils/errors'
import {
  CONTAINER_LABELS,
  ORDER_STATUS_META,
  PAYMENT_METHOD_LABELS,
} from '../../utils/constants'
import {
  formatDeliveryDate,
  formatDateTime,
} from '../../utils/dates'
import { formatKm } from '../../utils/calculations'
import { formatPeso } from '../../utils/money'
import {
  Alert,
  Card,
  EmptyState,
  PageHeader,
  Spinner,
} from '../../components/common/ui'
import { Button } from '../../components/common/Button'
import {
  OrderStatusBadge,
  PaymentStatusBadge,
} from '../../components/common/StatusBadges'
import {
  RouteMap,
  type RouteMapDestination,
  type RouteMapLine,
} from '../../components/common/RouteMap'

function DetailRow({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-900">{value}</span>
    </div>
  )
}

export function AdminOrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>()

  const [order, setOrder] = useState<OrderWithRelations | null>(null)
  const [history, setHistory] = useState<DeliveryHistoryEntry[]>([])
  const [station, setStation] = useState<StationSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [route, setRoute] = useState<RoadRoute | null>(null)
  const [routing, setRouting] = useState(false)
  const [routeError, setRouteError] = useState<string | null>(null)

  const load = useCallback(
    async (silent = false) => {
      if (!orderId) return
      if (!silent) setLoading(true)
      setError(null)
      try {
        const [nextOrder, nextHistory, nextStation] = await Promise.all([
          getOrderWithRelations(orderId),
          getOrderHistory(orderId),
          getStationSettings(),
        ])
        setOrder(nextOrder)
        setHistory(nextHistory)
        setStation(nextStation)
      } catch (loadError) {
        setError(getErrorMessage(loadError))
      } finally {
        setLoading(false)
      }
    },
    [orderId],
  )

  useEffect(() => {
    void load()
  }, [load])

  useRealtimeRefresh('orders', () => void load(true))
  useRealtimeRefresh('payments', () => void load(true))
  useRealtimeRefresh('delivery_history', () => void load(true))

  const stationPoint = useMemo(
    () => (station ? { lat: station.latitude, lng: station.longitude } : null),
    [station],
  )

  const destination = useMemo(
    () =>
      order
        ? {
            lat: Number(order.delivery_latitude),
            lng: Number(order.delivery_longitude),
          }
        : null,
    [order],
  )

  useEffect(() => {
    if (!stationPoint || !destination) {
      setRoute(null)
      setRouting(false)
      setRouteError(null)
      return
    }

    let cancelled = false
    const controller = new AbortController()
    setRouting(true)
    setRouteError(null)

    getRoadRoute(stationPoint, destination, controller.signal)
      .then((nextRoute) => {
        if (cancelled) return
        setRoute(nextRoute)
        setRouting(false)
      })
      .catch((routeFailure) => {
        if ((routeFailure as Error).name === 'AbortError') return
        if (cancelled) return
        setRoute(null)
        setRouteError(getErrorMessage(routeFailure))
        setRouting(false)
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [stationPoint, destination])

  const destinations = useMemo<RouteMapDestination[]>(
    () =>
      order && destination
        ? [
            {
              id: order.id,
              label: `${order.order_code} · ${order.delivery_address}`,
              status: order.order_status,
              lat: destination.lat,
              lng: destination.lng,
            },
          ]
        : [],
    [order, destination],
  )

  const routeLines = useMemo<RouteMapLine[]>(
    () =>
      order && route
        ? [{ id: order.id, coordinates: route.coordinates }]
        : [],
    [order, route],
  )

  if (loading && !order) {
    return <Spinner label="Loading order…" />
  }

  if (error || !order) {
    return (
      <div className="space-y-4">
        <Alert tone="error" title="Unable to load this order">
          {error ?? 'Order not found.'}
        </Alert>
        <Link to="/admin/orders">
          <Button variant="outline" icon={<ArrowLeft className="h-4 w-4" />}>
            Back to orders
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={order.order_code}
        title="Order details"
        description={`Placed ${formatDateTime(order.created_at)}`}
        actions={
          <>
            <Button
              variant="outline"
              icon={<RefreshCw className="h-4 w-4" />}
              onClick={() => void load(true)}
            >
              Refresh
            </Button>
            <Link to="/admin/orders">
              <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />}>
                Orders
              </Button>
            </Link>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <OrderStatusBadge status={order.order_status} />
        <PaymentStatusBadge status={order.payment_status} />
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
          {PAYMENT_METHOD_LABELS[order.payment_method]}
        </span>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Water order
                  </h2>
                  <p className="text-xs text-slate-400">
                    {order.water_quantity} × 19L purified drinking water
                  </p>
                </div>
              </div>
              <span className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
                {CONTAINER_LABELS[order.container_type]}
              </span>
            </div>

            <div className="mt-5 divide-y divide-slate-100 rounded-xl border border-slate-100 px-4">
              <DetailRow
                label="Water price at order time"
                value={`${formatPeso(order.water_price_snapshot)} × ${order.water_quantity}`}
              />
              <DetailRow
                label="Container price at order time"
                value={formatPeso(order.container_price_snapshot)}
              />
              <DetailRow
                label="Water subtotal"
                value={formatPeso(order.water_subtotal)}
              />
              <DetailRow
                label="Container subtotal"
                value={formatPeso(order.container_subtotal)}
              />
              <DetailRow
                label="Delivery fee"
                value={formatPeso(order.delivery_fee)}
              />
              <DetailRow
                label="Total"
                value={
                  <span className="text-base font-bold text-slate-900">
                    {formatPeso(order.total_amount)}
                  </span>
                }
              />
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Delivery information
                </h2>
                <p className="text-xs text-slate-400">
                  Road distance {formatKm(order.delivery_distance_km)} · minimum{' '}
                  {order.minimum_required_quantity} containers
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="space-y-3 text-sm">
                <p className="flex items-start gap-2 text-slate-600">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  {order.delivery_address}
                </p>
                <p className="flex items-center gap-2 text-slate-600">
                  <CalendarClock className="h-4 w-4 text-slate-400" />
                  {formatDeliveryDate(order.delivery_date)} ·{' '}
                  {order.delivery_time}
                </p>
                {order.delivery_instructions ? (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    <span className="font-semibold">Instructions: </span>
                    {order.delivery_instructions}
                  </p>
                ) : (
                  <p className="text-xs text-slate-400">
                    No special delivery instructions.
                  </p>
                )}
                {order.delivered_at ? (
                  <p className="flex items-center gap-2 text-xs font-medium text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    Delivered {formatDateTime(order.delivered_at)}
                  </p>
                ) : null}
                {order.cancelled_at ? (
                  <p className="flex items-center gap-2 text-xs font-medium text-rose-600">
                    <XCircle className="h-4 w-4" />
                    Cancelled {formatDateTime(order.cancelled_at)}
                  </p>
                ) : null}
                {order.driver ? (
                  <p className="flex items-center gap-2 text-xs text-slate-500">
                    <Truck className="h-4 w-4 text-slate-400" />
                    Driver: {order.driver.full_name}
                  </p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <RouteMap
                  station={stationPoint}
                  driver={null}
                  destinations={destinations}
                  routes={routeLines}
                  heightClass="h-52"
                />
                {routing ? (
                  <p className="text-[11px] text-slate-500">
                    Calculating the route from the station…
                  </p>
                ) : route ? (
                  <p className="text-[11px] text-slate-500">
                    {route.distanceKm} km by road · about{' '}
                    {route.durationMinutes} min from the station
                  </p>
                ) : routeError ? (
                  <p className="text-[11px] text-amber-700">
                    Route unavailable ({routeError}).
                  </p>
                ) : null}
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-base font-semibold text-slate-900">
              Delivery timeline
            </h2>
            {history.length === 0 ? (
              <div className="mt-3">
                <EmptyState
                  icon={Truck}
                  title="No history yet"
                  description="Status changes will be logged here."
                />
              </div>
            ) : (
              <ol className="mt-4 space-y-0">
                {history.map((entry, index) => (
                  <li key={entry.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={`mt-1 h-2.5 w-2.5 rounded-full ${ORDER_STATUS_META[entry.status].dot}`}
                      />
                      {index < history.length - 1 ? (
                        <span className="my-1 w-px flex-1 bg-slate-200" />
                      ) : null}
                    </div>
                    <div className="pb-4">
                      <p className="text-sm font-medium text-slate-800">
                        {ORDER_STATUS_META[entry.status].label}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {formatDateTime(entry.created_at)}
                        {entry.driver?.full_name
                          ? ` · ${entry.driver.full_name}`
                          : ''}
                        {entry.note ? ` · ${entry.note}` : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                <UserRound className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Customer
                </h2>
                <p className="text-xs text-slate-400">Account details</p>
              </div>
            </div>
            <div className="mt-4 space-y-1 text-sm">
              <p className="font-semibold text-slate-900">
                {order.customer_name || order.customer?.full_name}
              </p>
              <p className="text-slate-500">
                {order.customer?.email ?? 'No email on record'}
              </p>
              <p className="flex items-center gap-1.5 text-slate-500">
                <Phone className="h-3.5 w-3.5" />
                {order.customer_phone ||
                  order.customer?.phone ||
                  'No phone on record'}
              </p>
            </div>
            <Link
              to={`/admin/orders?customer=${order.customer_id}`}
              className="mt-4 inline-block text-xs font-semibold text-brand-700 hover:text-brand-800"
            >
              View customer order history →
            </Link>
          </Card>
        </div>
      </div>
    </div>
  )
}
