import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Droplets,
  MapPin,
  Package,
  Plus,
  RefreshCw,
  Truck,
} from 'lucide-react'
import type { Order } from '../../types'
import { listCustomerOrders } from '../../services/orders'
import { useAuth } from '../../contexts/AuthContext'
import { usePublicConfig } from '../../hooks/usePublicConfig'
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh'
import { getErrorMessage } from '../../utils/errors'
import {
  ACTIVE_ORDER_STATUSES,
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
  EmptyState,
  PageHeader,
  Spinner,
  StatCard,
} from '../../components/common/ui'
import { Button } from '../../components/common/Button'
import {
  OrderStatusBadge,
  PaymentStatusBadge,
} from '../../components/common/StatusBadges'

export function CustomerDashboardPage() {
  const { profile } = useAuth()
  const { config, loading: configLoading } = usePublicConfig()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!profile?.id) return
    if (!silent) setLoading(true)
    setError(null)
    try {
      setOrders(await listCustomerOrders(profile.id))
    } catch (loadError) {
      setError(getErrorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }, [profile?.id])

  useEffect(() => {
    void load()
  }, [load])

  useRealtimeRefresh('orders', () => void load(true))

  const activeOrders = useMemo(
    () =>
      orders.filter((order) => ACTIVE_ORDER_STATUSES.includes(order.order_status)),
    [orders],
  )

  const completedOrders = useMemo(
    () => orders.filter((order) => order.order_status === 'delivered'),
    [orders],
  )

  const totalSpent = useMemo(
    () =>
      completedOrders
        .filter((order) => order.payment_status === 'paid')
        .reduce((sum, order) => sum + Number(order.total_amount), 0),
    [completedOrders],
  )

  const firstName = profile?.full_name?.split(' ')[0] || 'there'

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Customer dashboard"
        title={`Hello, ${firstName}!`}
        description="Order purified 19L water, follow your deliveries and keep track of every refill."
        actions={
          <>
            <Button
              variant="outline"
              icon={<RefreshCw className="h-4 w-4" />}
              onClick={() => void load(true)}
            >
              Refresh
            </Button>
            <Link to="/customer/order">
              <Button icon={<Plus className="h-4 w-4" />}>Order water</Button>
            </Link>
          </>
        }
      />

      {error ? (
        <Alert tone="error" title="Could not load your orders">
          {error}
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Active orders"
          value={activeOrders.length}
          icon={Truck}
          tone="brand"
        />
        <StatCard
          label="Completed"
          value={completedOrders.length}
          icon={Package}
          tone="emerald"
        />
        <StatCard
          label="Total paid"
          value={formatPeso(totalSpent)}
          icon={Droplets}
          tone="violet"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Active orders
              </h2>
              <p className="text-xs text-slate-400">
                Track your water from the station to your door
              </p>
            </div>
            <Link
              to="/customer/orders"
              className="text-xs font-semibold text-brand-700 hover:text-brand-800"
            >
              All orders →
            </Link>
          </div>

          {loading && orders.length === 0 ? (
            <Spinner label="Loading orders…" />
          ) : activeOrders.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={Truck}
                title="No active orders"
                description="Ready for a refill? Place an order and choose a delivery window."
                action={
                  <Link to="/customer/order">
                    <Button icon={<Plus className="h-4 w-4" />}>
                      Order water
                    </Button>
                  </Link>
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {activeOrders.map((order) => (
                <li key={order.id}>
                  <Link
                    to={`/customer/orders/${order.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-4 transition hover:bg-slate-50/80"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">
                          {order.order_code}
                        </p>
                        <OrderStatusBadge status={order.order_status} />
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {order.water_quantity} × 19L ·{' '}
                        {formatDeliveryDate(order.delivery_date)} ·{' '}
                        {order.delivery_time}
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">
                          {order.delivery_address}
                        </span>
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <p className="text-sm font-bold text-slate-900">
                        {formatPeso(order.total_amount)}
                      </p>
                      <PaymentStatusBadge status={order.payment_status} />
                      <ArrowRight className="h-4 w-4 text-slate-300" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-br from-brand-600 to-brand-800 p-5 text-white">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-100">
                <Droplets className="h-4 w-4" />
                Today’s product
              </div>
              <h2 className="mt-2 text-lg font-bold">{PRODUCT_NAME}</h2>
              {configLoading || !config ? (
                <div className="mt-3 h-8 w-32 animate-pulse rounded bg-white/20" />
              ) : (
                <p className="mt-3 text-3xl font-bold">
                  {formatPeso(config.pricing.water_price)}
                  <span className="ml-1 text-sm font-medium text-brand-100">
                    / container
                  </span>
                </p>
              )}
            </div>
            <div className="space-y-2.5 p-5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">New container</span>
                <span className="font-semibold text-slate-900">
                  {config ? formatPeso(config.pricing.container_price) : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Delivery fee</span>
                <span className="font-semibold text-slate-900">
                  {config ? formatPeso(config.pricing.delivery_fee) : '—'}
                </span>
              </div>
              <Link to="/customer/order" className="block pt-2">
                <Button fullWidth icon={<Plus className="h-4 w-4" />}>
                  Start an order
                </Button>
              </Link>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-slate-900">
              Recent activity
            </h2>
            <div className="mt-3 space-y-3">
              {orders.slice(0, 4).map((order) => (
                <Link
                  key={order.id}
                  to={`/customer/orders/${order.id}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2.5 transition hover:border-brand-200 hover:bg-brand-50/40"
                >
                  <div>
                    <p className="text-xs font-semibold text-slate-800">
                      {order.order_code}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {formatDateTime(order.created_at)}
                    </p>
                  </div>
                  <OrderStatusBadge status={order.order_status} />
                </Link>
              ))}
              {orders.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Your order history will appear here.
                </p>
              ) : null}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
