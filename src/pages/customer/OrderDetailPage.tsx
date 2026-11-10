import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Banknote,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  MapPin,
  Package,
  RefreshCw,
  Truck,
  XCircle,
} from 'lucide-react'
import type {
  DeliveryHistoryEntry,
  Order,
  Payment,
  StationSettings,
} from '../../types'
import {
  getOrderById,
  getOrderHistory,
  cancelOrder,
} from '../../services/orders'
import { getPaymentForOrder } from '../../services/payments'
import { getStationSettings } from '../../services/settings'
import { getRoadRoute, type RoadRoute } from '../../services/maps'
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh'
import { useToast } from '../../contexts/ToastContext'
import { getErrorMessage } from '../../utils/errors'
import {
  CONTAINER_LABELS,
  ORDER_STATUS_META,
  PAYMENT_METHOD_LABELS,
  PRODUCT_NAME,
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

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-900">{value}</span>
    </div>
  )
}

export function CustomerOrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const [searchParams] = useSearchParams()
  const toast = useToast()
  const [order, setOrder] = useState<Order | null>(null)
  const [payment, setPayment] = useState<Payment | null>(null)
  const [history, setHistory] = useState<DeliveryHistoryEntry[]>([])
  const [station, setStation] = useState<StationSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [route, setRoute] = useState<RoadRoute | null>(null)
  const [routing, setRouting] = useState(false)
  const [routeError, setRouteError] = useState<string | null>(null)

  const placed = searchParams.get('placed') === '1'
  const paymentSuccess = searchParams.get('payment') === 'success'

  const load = useCallback(
    async (silent = false) => {
      if (!orderId) return
      if (!silent) setLoading(true)
      setError(null)
      try {
        const [nextOrder, nextPayment, nextHistory, nextStation] =
          await Promise.all([
            getOrderById(orderId),
            getPaymentForOrder(orderId).catch(() => null),
            getOrderHistory(orderId),
            getStationSettings(),
          ])
        setOrder(nextOrder)
        setPayment(nextPayment)
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
      .catch((error) => {
        if ((error as Error).name === 'AbortError') return
        if (cancelled) return
        setRoute(null)
        setRouteError(getErrorMessage(error))
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

  const handleCancel = async () => {
    if (!orderId) return
    setCancelling(true)
    try {
      await cancelOrder(orderId)
      toast.success('Order cancelled.')
      setCancelOpen(false)
      await load(true)
    } catch (cancelError) {
      toast.error(getErrorMessage(cancelError))
    } finally {
      setCancelling(false)
    }
  }

  if (loading && !order) return <Spinner label="Loading your order…" />

  if (error || !order) {
    return (
      <div className="space-y-4">
        <Alert tone="error" title="Unable to load this order">
          {error ?? 'Order not found.'}
        </Alert>
        <Link to="/customer/orders">
          <Button variant="outline" icon={<ArrowLeft className="h-4 w-4" />}>
            Back to my orders
          </Button>
        </Link>
      </div>
    )
  }

  const isActive =
    order.order_status !== 'delivered' && order.order_status !== 'cancelled'
  const canPayOnline =
    order.payment_method === 'stripe' &&
    order.payment_status !== 'paid' &&
    order.order_status !== 'cancelled'
  const canCancel =
    order.order_status === 'pending' && order.payment_status === 'pending'

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
            <Link to="/customer/orders">
              <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />}>
                My orders
              </Button>
            </Link>
          </>
        }
      />

      {placed ? (
        <Alert tone="success" title="Order placed successfully">
          Keep your phone nearby. The station will confirm your order and assign
          a driver. You can pay cash when the water arrives.
        </Alert>
      ) : null}

      {paymentSuccess ? (
        order.payment_status === 'paid' ? (
          <Alert tone="success" title="Payment received">
            Your payment has been recorded. Thank you!
          </Alert>
        ) : null
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <OrderStatusBadge status={order.order_status} />
        <PaymentStatusBadge status={order.payment_status} />
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
          {PAYMENT_METHOD_LABELS[order.payment_method]}
        </span>
      </div>

      {canPayOnline ? (
        <Alert
          tone="warning"
          title="Payment not completed"
          action={
            <Link to={`/customer/checkout/${order.id}`}>
              <Button size="sm" icon={<CreditCard className="h-3.5 w-3.5" />}>
                Pay now
              </Button>
            </Link>
          }
        >
          This order is reserved, but it is not paid yet. Complete your card
          payment to confirm it.
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    {PRODUCT_NAME}
                  </h2>
                  <p className="text-xs text-slate-400">
                    {order.water_quantity} container(s) ·{' '}
                    {CONTAINER_LABELS[order.container_type]}
                  </p>
                </div>
              </div>
              <p className="text-lg font-bold text-slate-900">
                {formatPeso(order.total_amount)}
              </p>
            </div>

            <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-100 px-4">
              <Row
                label="Water"
                value={`${formatPeso(order.water_price_snapshot)} × ${order.water_quantity}`}
              />
              <Row
                label="Container subtotal"
                value={formatPeso(order.container_subtotal)}
              />
              <Row label="Water subtotal" value={formatPeso(order.water_subtotal)} />
              <Row label="Delivery fee" value={formatPeso(order.delivery_fee)} />
              <Row
                label="Total"
                value={
                  <span className="text-base font-bold">
                    {formatPeso(order.total_amount)}
                  </span>
                }
              />
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <MapPin className="h-5 w-5 text-brand-600" />
              Delivery details
            </h2>
            <div className="mt-3 space-y-2.5 text-sm text-slate-600">
              <p className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                {order.delivery_address}
              </p>
              <p className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-slate-400" />
                {formatDeliveryDate(order.delivery_date)} · {order.delivery_time}
              </p>
              <p className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-slate-400" />
                {order.delivery_distance_km} km by road · minimum{' '}
                {order.minimum_required_quantity} containers
              </p>
              {order.delivery_instructions ? (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <span className="font-semibold">Instructions: </span>
                  {order.delivery_instructions}
                </p>
              ) : null}
              {order.delivered_at ? (
                <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Delivered {formatDateTime(order.delivered_at)}
                </p>
              ) : null}
              {order.cancelled_at ? (
                <p className="flex items-center gap-1.5 text-xs font-medium text-rose-600">
                  <XCircle className="h-4 w-4" />
                  Cancelled {formatDateTime(order.cancelled_at)}
                </p>
              ) : null}
            </div>

            <div className="mt-4 space-y-1.5">
              <RouteMap
                station={stationPoint}
                driver={null}
                destinations={destinations}
                routes={routeLines}
                heightClass="h-56"
              />
              {routing ? (
                <p className="px-1 text-[11px] text-slate-500">
                  Calculating the route from the station…
                </p>
              ) : route ? (
                <p className="px-1 text-[11px] text-slate-500">
                  {route.distanceKm} km by road · about {route.durationMinutes}{' '}
                  min from the station
                </p>
              ) : routeError ? (
                <p className="px-1 text-[11px] text-amber-700">
                  The route could not be drawn right now ({routeError}). The map
                  still shows the delivery pin.
                </p>
              ) : null}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-base font-semibold text-slate-900">
              Order timeline
            </h2>
            {history.length === 0 ? (
              <div className="mt-3">
                <EmptyState
                  icon={Truck}
                  title="No updates yet"
                  description="The station will update this order soon."
                />
              </div>
            ) : (
              <ol className="mt-4">
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
            <h2 className="text-sm font-semibold text-slate-900">Payment</h2>
            <div className="mt-3 divide-y divide-slate-100">
              <Row
                label="Method"
                value={PAYMENT_METHOD_LABELS[order.payment_method]}
              />
              <Row
                label="Status"
                value={<PaymentStatusBadge status={order.payment_status} />}
              />
              <Row label="Amount" value={formatPeso(order.total_amount)} />
              {payment?.paid_at ? (
                <Row label="Paid at" value={formatDateTime(payment.paid_at)} />
              ) : null}
            </div>

            {order.payment_method === 'cod' &&
            order.payment_status === 'pending' &&
            isActive ? (
              <p className="mt-4 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <Banknote className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Please prepare {formatPeso(order.total_amount)} in cash for the
                driver.
              </p>
            ) : null}

            {canPayOnline ? (
              <Link to={`/customer/checkout/${order.id}`} className="mt-4 block">
                <Button fullWidth>Complete payment</Button>
              </Link>
            ) : null}

            {canCancel ? (
              <Button
                fullWidth
                variant="outline"
                className="mt-3 text-rose-600 ring-rose-200 hover:bg-rose-50"
                onClick={() => setCancelOpen(true)}
                icon={<XCircle className="h-4 w-4" />}
              >
                Cancel order
              </Button>
            ) : null}

            {order.payment_status === 'paid' ? (
              <p className="mt-4 flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                Payment verified
              </p>
            ) : null}
          </Card>

          <Card className="p-5 text-xs leading-relaxed text-slate-500">
            <p className="font-semibold text-slate-900">Need help?</p>
            <p className="mt-1">
              Contact the station at{' '}
              <span className="font-medium text-slate-700">
                {station?.contact_number || 'the number listed on the landing page'}
              </span>{' '}
              and mention order {order.order_code}.
            </p>
            <p className="mt-3">{station?.operating_hours}</p>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={cancelOpen}
        title="Cancel this order?"
        message={`Order ${order.order_code} will be cancelled and its delivery slot released. This cannot be undone.`}
        confirmLabel="Cancel order"
        loading={cancelling}
        onConfirm={() => void handleCancel()}
        onClose={() => setCancelOpen(false)}
      />
    </div>
  )
}
