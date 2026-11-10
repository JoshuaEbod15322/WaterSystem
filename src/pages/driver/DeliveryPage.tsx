import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  Crosshair,
  ExternalLink,
  MapPin,
  Navigation,
  Package,
  Phone,
  RefreshCw,
  Route,
  Truck,
  XCircle,
} from 'lucide-react'
import type { Order, StationSettings } from '../../types'
import { acceptOrder, getOrderById, updateOrderStatus } from '../../services/orders'
import { getStationSettings } from '../../services/settings'
import { getRoadRoute } from '../../services/maps'
import { useAuth } from '../../contexts/AuthContext'
import { useDriverLocation } from '../../hooks/useDriverLocation'
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh'
import { useToast } from '../../contexts/ToastContext'
import { getErrorMessage } from '../../utils/errors'
import {
  CONTAINER_LABELS,
  PAYMENT_METHOD_LABELS,
} from '../../utils/constants'
import {
  formatDeliveryDate,
  formatDateTime,
} from '../../utils/dates'
import { formatPeso } from '../../utils/money'
import {
  Alert,
  Card,
  ConfirmDialog,
  Spinner,
} from '../../components/common/ui'
import { Button } from '../../components/common/Button'
import {
  OrderStatusBadge,
  PaymentStatusBadge,
} from '../../components/common/StatusBadges'
import { RouteMap } from '../../components/common/RouteMap'

const DELIVERY_STEPS = [
  { key: 'out_for_delivery', label: 'Out for delivery', icon: Navigation },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2 },
] as const

export function DriverDeliveryPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const {
    position,
    error: gpsError,
    active: gpsActive,
    status: gpsStatus,
    start: startGps,
  } = useDriverLocation(profile?.id)

  const [order, setOrder] = useState<Order | null>(null)
  const [station, setStation] = useState<StationSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)
  const [accepting, setAccepting] = useState(false)
  const [deliverOpen, setDeliverOpen] = useState(false)

  const [route, setRoute] = useState<{
    distanceKm: number
    durationMinutes: number
    coordinates: Array<[number, number]>
  } | null>(null)
  const [routing, setRouting] = useState(false)
  const [routeError, setRouteError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  const load = useCallback(
    async (silent = false) => {
      if (!orderId) return
      if (!silent) setLoading(true)
      setError(null)
      try {
        const [nextOrder, nextStation] = await Promise.all([
          getOrderById(orderId),
          getStationSettings(),
        ])
        setOrder(nextOrder)
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

  const originLat = position?.lat ?? station?.latitude
  const originLng = position?.lng ?? station?.longitude
  const origin = useMemo(() => {
    if (originLat === undefined || originLng === undefined) return null
    return {
      lat: Math.round(originLat * 1000) / 1000,
      lng: Math.round(originLng * 1000) / 1000,
    }
  }, [originLat, originLng])

  const destinationLat = order ? Number(order.delivery_latitude) : null
  const destinationLng = order ? Number(order.delivery_longitude) : null

  useEffect(() => {
    if (
      !origin ||
      destinationLat === null ||
      destinationLng === null ||
      Number.isNaN(destinationLat) ||
      Number.isNaN(destinationLng)
    ) {
      setRoute(null)
      return
    }

    const controller = new AbortController()
    setRouting(true)
    setRouteError(null)

    getRoadRoute(
      origin,
      { lat: destinationLat, lng: destinationLng },
      controller.signal,
    )
      .then((nextRoute) => {
        setRoute(nextRoute)
        setRouting(false)
      })
      .catch((routingError) => {
        if ((routingError as Error).name === 'AbortError') return
        setRoute(null)
        setRouteError(getErrorMessage(routingError))
        setRouting(false)
      })

    return () => controller.abort()
  }, [origin, destinationLat, destinationLng, retryKey])

  const stationPoint = station
    ? { lat: station.latitude, lng: station.longitude }
    : null

  const handleAccept = async () => {
    if (!order) return
    setAccepting(true)
    try {
      const updated = await acceptOrder(order.id)
      setOrder(updated)
      toast.success('Delivery accepted. Drive safely!')
    } catch (acceptError) {
      toast.error(getErrorMessage(acceptError))
      void load(true)
    } finally {
      setAccepting(false)
    }
  }

  const handleDelivered = async () => {
    if (!order) return
    setUpdating(true)
    try {
      const updated = await updateOrderStatus(order.id, 'delivered')
      setOrder(updated)
      setDeliverOpen(false)
      toast.success('Delivery completed. Great job!')
    } catch (updateError) {
      toast.error(getErrorMessage(updateError))
    } finally {
      setUpdating(false)
    }
  }

  if (loading && !order) {
    return <Spinner label="Loading delivery…" />
  }

  if (error || !order) {
    return (
      <div className="space-y-4">
        <Alert tone="error" title="Unable to load this delivery">
          {error ?? 'Order not found.'}
        </Alert>
        <Link to="/driver">
          <Button variant="outline" icon={<ArrowLeft className="h-4 w-4" />}>
            Back to deliveries
          </Button>
        </Link>
      </div>
    )
  }

  // Pending, unassigned orders are visible to every active driver as a
  // read-only preview until one of them accepts it.
  const isAvailable =
    order.order_status === 'pending' && order.driver_id === null

  if (order.driver_id !== profile?.id && !isAvailable) {
    return (
      <div className="space-y-4">
        <Alert tone="warning" title="This delivery is not assigned to you">
          Only the assigned driver can view and update this order.
        </Alert>
        <Link to="/driver">
          <Button variant="outline" icon={<ArrowLeft className="h-4 w-4" />}>
            Back to deliveries
          </Button>
        </Link>
      </div>
    )
  }

  const isDelivered = order.order_status === 'delivered'
  const isCancelled = order.order_status === 'cancelled'
  const isOut = order.order_status === 'out_for_delivery'
  const currentStep = isAvailable
    ? -1
    : DELIVERY_STEPS.findIndex((step) => step.key === order.order_status)

  const cashDue =
    order.payment_method === 'cod' && order.payment_status !== 'paid'
      ? Number(order.total_amount)
      : 0

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Link
          to="/driver"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Deliveries
        </Link>
        <Button
          size="sm"
          variant="outline"
          icon={<RefreshCw className="h-3.5 w-3.5" />}
          onClick={() => void load(true)}
        >
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <OrderStatusBadge status={order.order_status} />
        <PaymentStatusBadge status={order.payment_status} />
        <span className="rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
          {PAYMENT_METHOD_LABELS[order.payment_method]}
        </span>
      </div>

      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          {order.order_code}
        </h1>
        <p className="text-xs text-slate-500">
          {formatDeliveryDate(order.delivery_date)} · {order.delivery_time}
        </p>
      </div>

      {isDelivered ? (
        <Alert tone="success" title="Delivery completed">
          Delivered {formatDateTime(order.delivered_at)}. This order is now in
          your history.
        </Alert>
      ) : null}

      {isCancelled ? (
        <Alert tone="error" title="Order cancelled">
          The station cancelled this delivery. No further action is needed.
        </Alert>
      ) : null}

      {isAvailable ? (
        <Alert tone="info" title="Available delivery">
          This pending order has not been assigned yet. Check the customer
          location and payment details, then accept it to start the delivery.
        </Alert>
      ) : null}

      <Card className="p-3">
        <RouteMap
          station={stationPoint}
          driver={position}
          destinations={[
            {
              id: order.id,
              label: `${order.customer_name} · ${order.delivery_address}`,
              status: order.order_status,
              lat: Number(order.delivery_latitude),
              lng: Number(order.delivery_longitude),
            },
          ]}
          routes={
            route
              ? [
                  {
                    id: order.id,
                    coordinates: route.coordinates,
                    color: isOut ? '#d97706' : '#0284c7',
                  },
                ]
              : []
          }
          heightClass="h-60"
        />

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {routing ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
              <Route className="h-3.5 w-3.5 animate-pulse" />
              Calculating route…
            </span>
          ) : route ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
              <Route className="h-3.5 w-3.5" />
              {route.distanceKm} km · ~{route.durationMinutes} min
            </span>
          ) : (
            <Button
              size="sm"
              variant="outline"
              icon={<RefreshCw className="h-3.5 w-3.5" />}
              onClick={() => setRetryKey((key) => key + 1)}
            >
              Retry route
            </Button>
          )}

          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${order.delivery_latitude},${order.delivery_longitude}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
          >
            <Navigation className="h-3.5 w-3.5" />
            Open navigation
            <ExternalLink className="h-3 w-3 opacity-70" />
          </a>

          {gpsActive ? (
            <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
              <Crosshair className="h-3 w-3" />
              GPS on
            </span>
          ) : gpsStatus === 'requesting' ? (
            <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-700">
              <Crosshair className="h-3 w-3 animate-pulse" />
              Locating…
            </span>
          ) : (
            <button
              type="button"
              onClick={startGps}
              className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 transition hover:text-amber-900"
            >
              <Crosshair className="h-3 w-3" />
              {gpsError ? 'Retry GPS' : 'Enable GPS'}
            </button>
          )}
        </div>

        {routeError ? (
          <p className="mt-2 text-[11px] text-amber-700">{routeError}</p>
        ) : null}
      </Card>

      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Deliver to
            </p>
            <p className="mt-0.5 text-base font-bold text-slate-900">
              {order.customer_name}
            </p>
          </div>
          {order.customer_phone ? (
            <a
              href={`tel:${order.customer_phone}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              <Phone className="h-3.5 w-3.5" />
              Call
            </a>
          ) : null}
        </div>

        <p className="mt-2 flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          {order.delivery_address}
        </p>

        {order.delivery_instructions ? (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900 ring-1 ring-amber-200">
            <span className="font-semibold">Instructions: </span>
            {order.delivery_instructions}
          </p>
        ) : null}

        {order.customer_phone ? (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
            <Phone className="h-3.5 w-3.5 text-slate-400" />
            {order.customer_phone}
          </p>
        ) : null}
      </Card>

      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {order.water_quantity} × 19L purified water
            </p>
            <p className="text-xs text-slate-500">
              {CONTAINER_LABELS[order.container_type]}
            </p>
          </div>
        </div>

        <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-sm">
          <div className="flex justify-between text-slate-500">
            <span>Water subtotal</span>
            <span>{formatPeso(order.water_subtotal)}</span>
          </div>
          {Number(order.container_subtotal) > 0 ? (
            <div className="flex justify-between text-slate-500">
              <span>New containers</span>
              <span>{formatPeso(order.container_subtotal)}</span>
            </div>
          ) : null}
          <div className="flex justify-between text-slate-500">
            <span>Delivery fee</span>
            <span>{formatPeso(order.delivery_fee)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-100 pt-2 font-semibold text-slate-900">
            <span>Order total</span>
            <span>{formatPeso(order.total_amount)}</span>
          </div>
        </div>

        {cashDue > 0 ? (
          <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2.5 text-xs font-medium text-amber-900 ring-1 ring-amber-200">
            Collect{' '}
            <span className="text-base font-bold">{formatPeso(cashDue)}</span> in
            cash from the customer.
          </div>
        ) : (
          <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200">
            Payment is already settled — do not collect cash.
          </p>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="text-sm font-semibold text-slate-900">
          Delivery progress
        </h2>

        <ol className="mt-3 space-y-0">
          {DELIVERY_STEPS.map((step, index) => {
            const complete = currentStep >= index
            const isCurrent = currentStep === index
            return (
              <li key={step.key} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-full ${
                      complete
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    <step.icon className="h-3.5 w-3.5" />
                  </span>
                  {index < DELIVERY_STEPS.length - 1 ? (
                    <span
                      className={`my-1 w-0.5 flex-1 ${
                        currentStep > index ? 'bg-emerald-500' : 'bg-slate-200'
                      }`}
                    />
                  ) : null}
                </div>
                <div className={index < DELIVERY_STEPS.length - 1 ? 'pb-4' : ''}>
                  <p
                    className={`text-sm font-semibold ${
                      isCurrent ? 'text-slate-900' : 'text-slate-500'
                    }`}
                  >
                    {step.label}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {complete
                      ? 'Completed'
                      : index === 0
                        ? 'Not started yet'
                        : 'Waiting for the previous step'}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>

        <div className="mt-3">
          {isAvailable ? (
            <Button
              fullWidth
              size="lg"
              variant="success"
              icon={<Truck className="h-5 w-5" />}
              loading={accepting}
              onClick={() => void handleAccept()}
            >
              Accept &amp; start delivery
            </Button>
          ) : null}

          {isOut ? (
            <Button
              fullWidth
              size="lg"
              variant="success"
              icon={<CheckCircle2 className="h-5 w-5" />}
              loading={updating}
              onClick={() => setDeliverOpen(true)}
            >
              Mark as delivered
            </Button>
          ) : null}

          {isDelivered ? (
            <Button
              fullWidth
              variant="outline"
              onClick={() => navigate('/driver/history')}
            >
              View delivery history
            </Button>
          ) : null}

          {isCancelled ? (
            <Button
              fullWidth
              variant="outline"
              icon={<XCircle className="h-4 w-4" />}
              onClick={() => navigate('/driver')}
            >
              Back to deliveries
            </Button>
          ) : null}

          {!isAvailable &&
          !isOut &&
          !isDelivered &&
          !isCancelled ? (
            <p className="text-xs text-slate-400">
              This order is not ready for delivery yet.
            </p>
          ) : null}
        </div>
      </Card>

      <ConfirmDialog
        open={deliverOpen}
        title="Confirm delivery"
        message={
          order.payment_method === 'cod' && order.payment_status !== 'paid'
            ? `Mark ${order.order_code} as delivered? Confirm you collected ${formatPeso(order.total_amount)} in cash. This cannot be undone from the driver app.`
            : `Mark ${order.order_code} as delivered? This cannot be undone from the driver app. Please make sure the customer has received the water.`
        }
        confirmLabel="Yes, delivered"
        tone="primary"
        loading={updating}
        onConfirm={() => void handleDelivered()}
        onClose={() => setDeliverOpen(false)}
      />
    </div>
  )
}
