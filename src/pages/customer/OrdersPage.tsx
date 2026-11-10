import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Package,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react'
import type { Order } from '../../types'
import { listCustomerOrders } from '../../services/orders'
import { useAuth } from '../../contexts/AuthContext'
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh'
import { getErrorMessage } from '../../utils/errors'
import {
  ACTIVE_ORDER_STATUSES,
  CONTAINER_SHORT_LABELS,
} from '../../utils/constants'
import { formatDeliveryDate } from '../../utils/dates'
import { formatPeso } from '../../utils/money'
import {
  Alert,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Spinner,
} from '../../components/common/ui'
import { Button } from '../../components/common/Button'
import {
  OrderStatusBadge,
  PaymentStatusBadge,
} from '../../components/common/StatusBadges'

type Tab = 'all' | 'active' | 'completed' | 'cancelled'

const tabs: Array<{ key: Tab; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
]

export function CustomerOrdersPage() {
  const { profile } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')

  const load = useCallback(
    async (silent = false) => {
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
    },
    [profile?.id],
  )

  useEffect(() => {
    void load()
  }, [load])

  useRealtimeRefresh('orders', () => void load(true))

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return orders.filter((order) => {
      if (tab === 'active' && !ACTIVE_ORDER_STATUSES.includes(order.order_status)) {
        return false
      }
      if (tab === 'completed' && order.order_status !== 'delivered') return false
      if (tab === 'cancelled' && order.order_status !== 'cancelled') return false
      if (!term) return true
      return (
        order.order_code.toLowerCase().includes(term) ||
        order.delivery_address.toLowerCase().includes(term)
      )
    })
  }, [orders, tab, search])

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="History"
        title="My orders"
        description="Track active deliveries and revisit every completed or cancelled order."
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
        <Alert tone="error" title="Could not load orders">
          {error}
        </Alert>
      ) : null}

      <Card className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {tabs.map((item) => (
              <Button
                key={item.key}
                size="sm"
                variant={tab === item.key ? 'primary' : 'outline'}
                onClick={() => setTab(item.key)}
              >
                {item.label}
                {item.key === 'active' ? (
                  <span className="ml-1 rounded-full bg-white/20 px-1.5 text-[10px]">
                    {
                      orders.filter((order) =>
                        ACTIVE_ORDER_STATUSES.includes(order.order_status),
                      ).length
                    }
                  </span>
                ) : null}
              </Button>
            ))}
          </div>

          <div className="relative w-full md:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search order code or address"
              className="pl-9"
              aria-label="Search my orders"
            />
          </div>
        </div>
      </Card>

      {loading && orders.length === 0 ? (
        <Spinner label="Loading your orders…" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title={search ? 'No matching orders' : 'No orders in this view'}
          description={
            search
              ? 'Try a different order code or address.'
              : tab === 'active'
                ? 'You have no active deliveries right now.'
                : 'Place your first water order to get started.'
          }
          action={
            !search && tab !== 'active' ? (
              <Link to="/customer/order">
                <Button icon={<Plus className="h-4 w-4" />}>Order water</Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => (
            <Card key={order.id} className="overflow-hidden">
              <Link
                to={`/customer/orders/${order.id}`}
                className="flex flex-col gap-3 p-4 transition hover:bg-slate-50/70 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-slate-900">
                      {order.order_code}
                    </p>
                    <OrderStatusBadge status={order.order_status} />
                    <PaymentStatusBadge status={order.payment_status} />
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500">
                    {order.water_quantity} × 19L ·{' '}
                    {CONTAINER_SHORT_LABELS[order.container_type]} ·{' '}
                    {formatPeso(order.total_amount)}
                  </p>
                  <p className="mt-1 truncate text-xs text-slate-400">
                    {formatDeliveryDate(order.delivery_date)} ·{' '}
                    {order.delivery_time} · {order.delivery_address}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs font-semibold text-brand-700">
                  {order.order_status === 'delivered' ? 'View receipt' : 'Track order'}
                  <ArrowRight className="h-4 w-4" />
                </div>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
