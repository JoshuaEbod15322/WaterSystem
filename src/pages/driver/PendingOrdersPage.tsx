import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  MapPin,
  Navigation,
  RefreshCw,
  Truck,
} from 'lucide-react'
import type { Order } from '../../types'
import { acceptOrder } from '../../services/orders'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { useDriverOrders } from '../../hooks/useDriverOrders'
import { getErrorMessage } from '../../utils/errors'
import { formatDeliveryDate } from '../../utils/dates'
import { formatPeso } from '../../utils/money'
import { CONTAINER_SHORT_LABELS } from '../../utils/constants'
import { Alert, Card, Spinner } from '../../components/common/ui'
import { Button } from '../../components/common/Button'
import { PaymentStatusBadge } from '../../components/common/StatusBadges'

export function DriverPendingOrdersPage() {
  const { profile } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const {
    orders,
    setOrders,
    availableOrders,
    setAvailableOrders,
    loading,
    error,
    load,
  } = useDriverOrders(profile?.id)
  const [acceptingId, setAcceptingId] = useState<string | null>(null)

  const activeCount = orders.filter(
    (order) => order.order_status === 'out_for_delivery',
  ).length
  const deliveredCount = orders.filter(
    (order) => order.order_status === 'delivered',
  ).length

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
      navigate('/driver/route')
    } catch (acceptError) {
      toast.error(getErrorMessage(acceptError))
      void load(true)
    } finally {
      setAcceptingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600">
            Customer orders
          </p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">
            Pending Orders
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

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            <Clock className="h-3 w-3" /> Pending
          </div>
          <p className="mt-1 text-2xl font-bold text-brand-700">
            {availableOrders.length}
          </p>
        </div>
        <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            <Navigation className="h-3 w-3" /> On route
          </div>
          <p className="mt-1 text-2xl font-bold text-amber-600">
            {activeCount}
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

      {activeCount > 0 ? (
        <Link to="/driver/route" className="block">
          <Card className="flex items-center gap-3 border-emerald-200 bg-emerald-50 p-4 transition hover:shadow-md">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <Navigation className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-emerald-900">
                {activeCount} stop{activeCount === 1 ? '' : 's'} on your active
                route
              </p>
              <p className="text-xs text-emerald-700">
                Open the map, share your location, and continue delivering.
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
              Go to route
              <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </Card>
        </Link>
      ) : null}

      {error ? (
        <Alert tone="error" title="Could not load orders">
          {error}
        </Alert>
      ) : null}

      {loading && orders.length === 0 ? (
        <Spinner label="Loading pending orders…" />
      ) : (
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Waiting for pickup
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
