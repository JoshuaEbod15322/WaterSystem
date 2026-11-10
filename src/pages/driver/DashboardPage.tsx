import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Crosshair,
  MapPin,
  Navigation,
  Package,
  Phone,
  RefreshCw,
  Truck,
} from 'lucide-react'
import type { Order, StationSettings } from '../../types'
import {
  acceptOrder,
  listAvailableOrders,
  listDriverOrders,
} from '../../services/orders'
import { getStationSettings } from '../../services/settings'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useDriverLocation } from '../../hooks/useDriverLocation'
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh'
import { getErrorMessage } from '../../utils/errors'
import { formatDeliveryDate } from '../../utils/dates'
import { formatPeso } from '../../utils/money'
import {
  CONTAINER_SHORT_LABELS,
  ORDER_STATUS_META,
} from '../../utils/constants'
import {
  Alert,
  Card,
  Spinner,
} from '../../components/common/ui'
import { Button } from '../../components/common/Button'
import {
  OrderStatusBadge,
  PaymentStatusBadge,
} from '../../components/common/StatusBadges'
import { DeliveryOverviewMap } from '../../components/driver/DeliveryOverviewMap'

export function DriverDashboardPage() {
  const { profile } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const { position, error: gpsError, active: gpsActive } = useDriverLocation(
    profile?.id,
  )

  const [orders, setOrders] = useState<Order[]>([])
  const [availableOrders, setAvailableOrders] = useState<Order[]>([])
  const [station, setStation] = useState<StationSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [acceptingId, setAcceptingId] = useState<string | null>(null)

  const load = useCallback(
    async (silent = false) => {
      if (!profile?.id) return
      if (!silent) setLoading(true)
      setError(null)
      try {
        const [nextOrders, nextStation, nextAvailable] = await Promise.all([
          listDriverOrders(profile.id),
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
    [profile?.id],
  )

  useEffect(() => {
    void load()
  }, [load])

  // Available orders are shared between drivers. Realtime hides rows after
  // another driver claims them, so poll gently to keep the list accurate.
  useEffect(() => {
    const interval = window.setInterval(() => void load(true), 30_000)
    return () => window.clearInterval(interval)
  }, [load])

  useRealtimeRefresh('orders', () => void load(true))

  const handleAccept = async (order: Order) => {
    setAcceptingId(order.id)
    try {
      const updated = await acceptOrder(order.id)
      toast.success(`${updated.order_code} accepted — drive safely!`)
      setAvailableOrders((current) =>
        current.filter((item) => item.id !== order.id),
      )
      setOrders((current) => [
        updated,
        ...current.filter((item) => item.id !== order.id),
      ])
      navigate(`/driver/deliveries/${order.id}`)
    } catch (acceptError) {
      toast.error(getErrorMessage(acceptError))
      void load(true)
    } finally {
      setAcceptingId(null)
    }
  }

  const activeOrders = useMemo(
    () =>
      orders
        .filter((order) => order.order_status === 'out_for_delivery')
        .sort((a, b) =>
          `${a.delivery_date}${a.delivery_time}`.localeCompare(
            `${b.delivery_date}${b.delivery_time}`,
          ),
        ),
    [orders],
  )

  const todayKey = format(new Date(), 'yyyy-MM-dd')
  const todayOrders = activeOrders.filter(
    (order) => order.delivery_date === todayKey,
  )
  const outForDelivery = activeOrders.filter(
    (order) => order.order_status === 'out_for_delivery',
  )
  const deliveredCount = orders.filter(
    (order) => order.order_status === 'delivered',
  ).length
  const cashToCollect = activeOrders
    .filter(
      (order) =>
        order.payment_method === 'cod' && order.payment_status !== 'paid',
    )
    .reduce((sum, order) => sum + Number(order.total_amount), 0)

  const stationPoint = station
    ? { lat: station.latitude, lng: station.longitude }
    : null

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600">
            Today’s route
          </p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">
            My deliveries
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          icon={<RefreshCw className="h-3.5 w-3.5" />}
          onClick={() => void load(true)}
        >
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            <Truck className="h-3 w-3" /> Pending
          </div>
          <p className="mt-1 text-2xl font-bold text-brand-700">
            {availableOrders.length}
          </p>
        </div>
        <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            <Clock className="h-3 w-3" /> Assigned
          </div>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {activeOrders.length - outForDelivery.length}
          </p>
        </div>
        <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            <Navigation className="h-3 w-3" /> On the way
          </div>
          <p className="mt-1 text-2xl font-bold text-amber-600">
            {outForDelivery.length}
          </p>
        </div>
        <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            <CheckCircle2 className="h-3 w-3" /> Done
          </div>
          <p className="mt-1 text-2xl font-bold text-emerald-600">
            {deliveredCount}
          </p>
        </div>
      </div>

      <div
        className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs font-medium ${
          gpsActive
            ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
            : 'bg-amber-50 text-amber-800 ring-1 ring-amber-200'
        }`}
      >
        <span className="flex items-center gap-1.5">
          <Crosshair className="h-3.5 w-3.5" />
          {gpsActive
            ? 'GPS sharing is on — the station can see your latest position.'
            : gpsError ?? 'Waiting for GPS permission…'}
        </span>
        {position ? (
          <span className="hidden font-mono text-[10px] sm:inline">
            {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
          </span>
        ) : null}
      </div>

      {error ? (
        <Alert tone="error" title="Could not load deliveries">
          {error}
        </Alert>
      ) : null}

      {loading && orders.length === 0 ? (
        <Spinner label="Loading your deliveries…" />
      ) : (
        <>
          <section className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Pending orders
              </h2>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                {availableOrders.length} waiting
              </span>
            </div>
            <p className="px-1 text-[11px] text-slate-500">
              All customer orders waiting for pickup. Tap one to accept it and
              start the delivery — another driver cannot take it once you do.
            </p>
            {availableOrders.length === 0 ? (
              <Card className="p-4">
                <p className="text-xs text-slate-500">
                  No pending customer orders right now. New orders will appear
                  here automatically.
                </p>
              </Card>
            ) : (
              availableOrders.map((order) => (
                <AvailableOrderCard
                  key={order.id}
                  order={order}
                  accepting={acceptingId === order.id}
                  onAccept={() => void handleAccept(order)}
                />
              ))
            )}
          </section>

          {activeOrders.length > 0 ? (
            <Card className="p-3">
              <DeliveryOverviewMap
                station={stationPoint}
                driver={position}
                orders={activeOrders}
                heightClass="h-64"
              />
            </Card>
          ) : null}

          {cashToCollect > 0 ? (
            <div className="flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3 text-white">
              <span className="flex items-center gap-2 text-xs font-medium text-slate-300">
                <Package className="h-4 w-4" />
                Cash to collect on this route
              </span>
              <span className="text-base font-bold text-emerald-300">
                {formatPeso(cashToCollect)}
              </span>
            </div>
          ) : null}

          {todayOrders.length > 0 ? (
            <section className="space-y-2">
              <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Due today
              </h2>
              {todayOrders.map((order) => (
                <DriverOrderCard key={order.id} order={order} />
              ))}
            </section>
          ) : null}

          {activeOrders.filter(
            (order) => order.delivery_date !== todayKey,
          ).length > 0 ? (
            <section className="space-y-2">
              <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Upcoming
              </h2>
              {activeOrders
                .filter((order) => order.delivery_date !== todayKey)
                .map((order) => (
                  <DriverOrderCard key={order.id} order={order} />
                ))}
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}

function AvailableOrderCard({
  order,
  accepting,
  onAccept,
}: {
  order: Order
  accepting: boolean
  onAccept: () => void
}) {
  const start = () => {
    if (!accepting) onAccept()
  }

  return (
    <div
      onClick={start}
      className={`rounded-2xl transition ${
        accepting ? 'cursor-wait opacity-70' : 'cursor-pointer'
      }`}
    >
      <Card className="p-4 ring-1 ring-emerald-100 transition hover:shadow-md hover:ring-emerald-300">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900">{order.order_code}</p>
            <p className="mt-0.5 text-xs font-medium text-slate-600">
              {order.customer_name}
            </p>
          </div>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
            Pending
          </span>
        </div>

        <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="line-clamp-2">{order.delivery_address}</span>
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
          <span>{formatDeliveryDate(order.delivery_date)}</span>
          <span className="text-slate-300">·</span>
          <span>{order.delivery_time}</span>
          <span className="text-slate-300">·</span>
          <span>
            {order.water_quantity} × 19L ·{' '}
            {CONTAINER_SHORT_LABELS[order.container_type]}
          </span>
          <span className="text-slate-300">·</span>
          <span>{Number(order.delivery_distance_km).toFixed(1)} km</span>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-900">
              {formatPeso(order.total_amount)}
            </span>
            <PaymentStatusBadge status={order.payment_status} />
          </div>
          <Button
            size="sm"
            variant="success"
            loading={accepting}
            onClick={(event) => {
              event.stopPropagation()
              start()
            }}
            icon={<Truck className="h-3.5 w-3.5" />}
          >
            Accept &amp; start
          </Button>
        </div>
      </Card>
    </div>
  )
}

function DriverOrderCard({ order }: { order: Order }) {
  const isOutForDelivery = order.order_status === 'out_for_delivery'
  return (
    <Link to={`/driver/deliveries/${order.id}`} className="block">
      <Card
        className={`p-4 transition hover:shadow-md ${
          isOutForDelivery ? 'ring-2 ring-amber-300' : ''
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900">
              {order.order_code}
            </p>
            <p className="mt-0.5 text-xs font-medium text-slate-600">
              {order.customer_name}
            </p>
          </div>
          <OrderStatusBadge status={order.order_status} />
        </div>

        <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="line-clamp-2">{order.delivery_address}</span>
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
          <span>{formatDeliveryDate(order.delivery_date)}</span>
          <span className="text-slate-300">·</span>
          <span>{order.delivery_time}</span>
          <span className="text-slate-300">·</span>
          <span>
            {order.water_quantity} × 19L ·{' '}
            {CONTAINER_SHORT_LABELS[order.container_type]}
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-900">
              {formatPeso(order.total_amount)}
            </span>
            <PaymentStatusBadge status={order.payment_status} />
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
            {isOutForDelivery ? 'Continue' : 'View stop'}
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>

        {order.customer_phone ? (
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
            <Phone className="h-3 w-3" />
            {order.customer_phone}
            <span className="ml-auto text-slate-300">
              {ORDER_STATUS_META[order.order_status].label}
            </span>
          </p>
        ) : null}
      </Card>
    </Link>
  )
}
