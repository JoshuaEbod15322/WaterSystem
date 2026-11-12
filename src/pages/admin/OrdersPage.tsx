import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  CalendarDays,
  Filter,
  Package,
  Search,
  X,
} from 'lucide-react'
import type { OrderStatus, OrderWithRelations } from '../../types'
import { listAdminOrders } from '../../services/orders'
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh'
import { getErrorMessage } from '../../utils/errors'
import { ORDER_STATUSES, ORDER_STATUS_META } from '../../utils/constants'
import {
  Alert,
  Card,
  Input,
  PageHeader,
  Select,
  Spinner,
} from '../../components/common/ui'
import { Button } from '../../components/common/Button'
import { OrderTable } from '../../components/admin/OrderTable'

export function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<OrderStatus | 'all'>('all')
  const [date, setDate] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()

  const driverFilter = searchParams.get('driver')
  const customerFilter = searchParams.get('customer')

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      const nextOrders = await listAdminOrders()
      setOrders(nextOrders)
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

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return orders.filter((order) => {
      if (status !== 'all' && order.order_status !== status) return false
      if (date && order.delivery_date !== date) return false
      if (driverFilter && order.driver_id !== driverFilter) return false
      if (customerFilter && order.customer_id !== customerFilter) return false
      if (!term) return true
      return (
        order.order_code.toLowerCase().includes(term) ||
        order.customer_name.toLowerCase().includes(term) ||
        (order.customer_phone ?? '').toLowerCase().includes(term) ||
        order.delivery_address.toLowerCase().includes(term)
      )
    })
  }, [orders, search, status, date, driverFilter, customerFilter])

  const activeLabel = driverFilter
    ? orders.find((order) => order.driver_id === driverFilter)?.driver?.full_name ??
      'selected driver'
    : customerFilter
      ? orders.find((order) => order.customer_id === customerFilter)?.customer
          ?.full_name ?? 'selected customer'
      : null

  const hasFilters =
    Boolean(search) || status !== 'all' || Boolean(date) || Boolean(activeLabel)

  const clearFilters = () => {
    setSearch('')
    setStatus('all')
    setDate('')
    if (driverFilter || customerFilter) {
      setSearchParams({})
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Operations"
        title="Order management"
        description="Search and inspect every customer order. Drivers claim pending deliveries themselves, and delivery status updates automatically."
      />

      {error ? (
        <Alert tone="error" title="Could not load orders">
          {error}
        </Alert>
      ) : null}

      {activeLabel ? (
        <Alert
          tone="info"
          action={
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear
            </Button>
          }
        >
          Showing orders for <span className="font-semibold">{activeLabel}</span>.
        </Alert>
      ) : null}

      <Card className="p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search order code, customer, phone or address"
              className="pl-9"
              aria-label="Search orders"
            />
          </div>

          <Select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as OrderStatus | 'all')
            }
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            {ORDER_STATUSES.map((option) => (
              <option key={option} value={option}>
                {ORDER_STATUS_META[option].label}
              </option>
            ))}
          </Select>

          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="pl-9"
              aria-label="Filter by delivery date"
            />
          </div>

          <Button
            variant="ghost"
            onClick={clearFilters}
            disabled={!hasFilters}
            icon={<X className="h-4 w-4" />}
          >
            Clear
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <Filter className="h-3.5 w-3.5" />
          <span>
            Showing <span className="font-semibold text-slate-900">{filtered.length}</span>{' '}
            of {orders.length} loaded orders
          </span>
          {status !== 'all' ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5">
              {ORDER_STATUS_META[status].label}
            </span>
          ) : null}
          {date ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5">{date}</span>
          ) : null}
        </div>
      </Card>

      {loading && orders.length === 0 ? (
        <Spinner label="Loading orders…" />
      ) : (
        <Card className="overflow-hidden">
          <OrderTable
            orders={filtered}
            emptyTitle={hasFilters ? 'No matching orders' : 'No orders yet'}
            emptyDescription={
              hasFilters
                ? 'Try clearing the search or filters.'
                : 'Customer orders will appear here as soon as they are placed.'
            }
          />
        </Card>
      )}

      {filtered.length > 0 ? (
        <p className="flex items-center gap-1.5 text-xs text-slate-400">
          <Package className="h-3.5 w-3.5" />
          Click an order to review its delivery route, customer and timeline.
        </p>
      ) : (
        <Link
          to="/admin/drivers"
          className="inline-block text-xs font-semibold text-brand-700 hover:text-brand-800"
        >
          Manage drivers →
        </Link>
      )}
    </div>
  )
}
