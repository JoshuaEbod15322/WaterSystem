import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle2,
  Droplets,
  Route,
  Search,
  Truck,
  Wallet,
  XCircle,
} from 'lucide-react'
import type { Order } from '../../types'
import { listDriverOrders } from '../../services/orders'
import { useAuth } from '../../contexts/AuthContext'
import { getErrorMessage } from '../../utils/errors'
import { formatDeliveryDate } from '../../utils/dates'
import { formatPeso } from '../../utils/money'
import {
  CONTAINER_SHORT_LABELS,
  PAYMENT_METHOD_LABELS,
} from '../../utils/constants'
import {
  Alert,
  Card,
  EmptyState,
  Input,
  Spinner,
} from '../../components/common/ui'
import { Button } from '../../components/common/Button'
import {
  OrderStatusBadge,
  PaymentStatusBadge,
} from '../../components/common/StatusBadges'

type Tab = 'delivered' | 'cancelled'

export function DriverHistoryPage() {
  const { profile } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('delivered')
  const [search, setSearch] = useState('')

  const load = useCallback(
    async (silent = false) => {
      if (!profile?.id) return
      if (!silent) setLoading(true)
      setError(null)
      try {
        setOrders(await listDriverOrders(profile.id))
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

  const delivered = useMemo(
    () =>
      orders
        .filter((order) => order.order_status === 'delivered')
        .sort((a, b) =>
          (b.delivered_at ?? b.created_at).localeCompare(
            a.delivered_at ?? a.created_at,
          ),
        ),
    [orders],
  )

  const cancelled = useMemo(
    () =>
      orders
        .filter((order) => order.order_status === 'cancelled')
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [orders],
  )

  const containersDelivered = delivered.reduce(
    (sum, order) => sum + Number(order.water_quantity),
    0,
  )

  const cashHandled = delivered
    .filter((order) => order.payment_method === 'cod')
    .reduce((sum, order) => sum + Number(order.total_amount), 0)

  const visible = useMemo(() => {
    const source = tab === 'delivered' ? delivered : cancelled
    const term = search.trim().toLowerCase()
    if (!term) return source
    return source.filter(
      (order) =>
        order.order_code.toLowerCase().includes(term) ||
        order.customer_name.toLowerCase().includes(term) ||
        order.delivery_address.toLowerCase().includes(term),
    )
  }, [tab, delivered, cancelled, search])

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600">
            Completed work
          </p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">
            Delivery history
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Every delivery assigned to your account.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            <CheckCircle2 className="h-3 w-3" /> Delivered
          </div>
          <p className="mt-1 text-2xl font-bold text-emerald-600">
            {delivered.length}
          </p>
        </div>
        <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            <Droplets className="h-3 w-3" /> Containers
          </div>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {containersDelivered}
          </p>
        </div>
        <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            <Wallet className="h-3 w-3" /> COD orders
          </div>
          <p className="mt-1 text-lg font-bold text-slate-900">
            {formatPeso(cashHandled)}
          </p>
        </div>
      </div>

      {error ? (
        <Alert tone="error" title="Could not load history">
          {error}
        </Alert>
      ) : null}

      <Card className="p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant={tab === 'delivered' ? 'primary' : 'outline'}
              onClick={() => setTab('delivered')}
              icon={<CheckCircle2 className="h-3.5 w-3.5" />}
            >
              Delivered ({delivered.length})
            </Button>
            <Button
              size="sm"
              variant={tab === 'cancelled' ? 'primary' : 'outline'}
              onClick={() => setTab('cancelled')}
              icon={<XCircle className="h-3.5 w-3.5" />}
            >
              Cancelled ({cancelled.length})
            </Button>
          </div>
          <div className="relative sm:w-56">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search history"
              className="pl-9"
              aria-label="Search delivery history"
            />
          </div>
        </div>
      </Card>

      {loading && orders.length === 0 ? (
        <Spinner label="Loading history…" />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={tab === 'delivered' ? Truck : XCircle}
          title={
            search
              ? 'No matching deliveries'
              : tab === 'delivered'
                ? 'No completed deliveries yet'
                : 'No cancelled deliveries'
          }
          description={
            search
              ? 'Try a different order code, customer or address.'
              : 'Completed deliveries will be listed here for your records.'
          }
        />
      ) : (
        <div className="space-y-2">
          {visible.map((order) => (
            <Card key={order.id} className="p-4">
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

              <p className="mt-2 text-xs text-slate-500">
                {order.delivery_address}
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

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <Route className="h-3.5 w-3.5" />
                  {order.delivery_distance_km} km ·{' '}
                  {PAYMENT_METHOD_LABELS[order.payment_method]}
                </span>
                <span className="flex items-center gap-2">
                  <PaymentStatusBadge status={order.payment_status} />
                  <span className="text-sm font-bold text-slate-900">
                    {formatPeso(order.total_amount)}
                  </span>
                </span>
              </div>

              <div className="mt-2 text-right">
                <Link
                  to={`/driver/deliveries/${order.id}`}
                  className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800"
                >
                  View details →
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
