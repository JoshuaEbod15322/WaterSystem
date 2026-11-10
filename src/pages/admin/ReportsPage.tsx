import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Banknote,
  BarChart3,
  CreditCard,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  XCircle,
} from 'lucide-react'
import {
  format,
  startOfDay,
  startOfMonth,
  subDays,
} from 'date-fns'
import type { OrderWithRelations } from '../../types'
import { getAllOrdersForReports } from '../../services/reports'
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh'
import { useToast } from '../../contexts/ToastContext'
import { getErrorMessage } from '../../utils/errors'
import { formatPeso } from '../../utils/money'
import { parseISO } from '../../utils/dates'
import {
  Alert,
  Card,
  EmptyState,
  PageHeader,
  Spinner,
  StatCard,
} from '../../components/common/ui'
import { Button } from '../../components/common/Button'

type RangeKey = 'today' | '7d' | '30d' | 'month' | 'all'

const rangeLabels: Record<RangeKey, string> = {
  today: 'Today',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  month: 'This month',
  all: 'All time',
}

function rangeStart(key: RangeKey): Date | null {
  const now = new Date()
  if (key === 'today') return startOfDay(now)
  if (key === '7d') return startOfDay(subDays(now, 6))
  if (key === '30d') return startOfDay(subDays(now, 29))
  if (key === 'month') return startOfMonth(now)
  return null
}

export function AdminReportsPage() {
  const [orders, setOrders] = useState<OrderWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [range, setRange] = useState<RangeKey>('30d')
  const toast = useToast()

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      setOrders(await getAllOrdersForReports())
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
    const start = rangeStart(range)
    if (!start) return orders
    return orders.filter((order) => {
      const createdAt = new Date(order.created_at)
      return createdAt >= start
    })
  }, [orders, range])

  const metrics = useMemo(() => {
    const completed = filtered.filter(
      (order) => order.order_status === 'delivered',
    )
    // Revenue is recognised as soon as the payment settles, even when the
    // water has not been delivered yet.
    const paidOrders = filtered.filter(
      (order) => order.payment_status === 'paid',
    )
    const cancelled = filtered.filter(
      (order) => order.order_status === 'cancelled',
    )
    const sales = paidOrders.reduce(
      (sum, order) => sum + Number(order.total_amount),
      0,
    )
    const stripePaid = paidOrders
      .filter((order) => order.payment_method === 'stripe')
      .reduce((sum, order) => sum + Number(order.total_amount), 0)
    const codPaid = paidOrders
      .filter((order) => order.payment_method === 'cod')
      .reduce((sum, order) => sum + Number(order.total_amount), 0)
    const codUncollected = completed.filter(
      (order) =>
        order.payment_method === 'cod' && order.payment_status === 'pending',
    )
    const codUncollectedAmount = codUncollected.reduce(
      (sum, order) => sum + Number(order.total_amount),
      0,
    )

    const dailyMap = new Map<
      string,
      { date: string; orders: number; sales: number }
    >()
    paidOrders.forEach((order) => {
      const paidAt = Array.isArray(order.payments)
        ? order.payments[0]?.paid_at
        : null
      const date = (paidAt ?? order.updated_at ?? order.created_at).slice(0, 10)
      const current = dailyMap.get(date) ?? { date, orders: 0, sales: 0 }
      current.orders += 1
      current.sales += Number(order.total_amount)
      dailyMap.set(date, current)
    })

    const daily = [...dailyMap.values()]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 14)

    return {
      sales,
      completed: completed.length,
      cancelled: cancelled.length,
      stripePaid,
      codPaid,
      codUncollectedCount: codUncollected.length,
      codUncollectedAmount,
      average: paidOrders.length ? sales / paidOrders.length : 0,
      totalOrders: filtered.length,
      daily,
      codOrders: filtered.filter((order) => order.payment_method === 'cod')
        .length,
      stripeOrders: filtered.filter(
        (order) => order.payment_method === 'stripe',
      ).length,
      paidOrders: paidOrders.length,
    }
  }, [filtered])

  const handleRefresh = async () => {
    await load(true)
    toast.success('Reports refreshed.')
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Insights"
        title="Sales reports"
        description="Simple sales, order and payment summaries based on orders created in the selected period."
        actions={
          <Button
            variant="outline"
            icon={<RefreshCw className="h-4 w-4" />}
            onClick={() => void handleRefresh()}
          >
            Refresh
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {(Object.keys(rangeLabels) as RangeKey[]).map((key) => (
          <Button
            key={key}
            size="sm"
            variant={range === key ? 'primary' : 'outline'}
            onClick={() => setRange(key)}
          >
            {rangeLabels[key]}
          </Button>
        ))}
      </div>

      {error ? (
        <Alert tone="error" title="Could not load reports">
          {error}
        </Alert>
      ) : null}

      {loading && orders.length === 0 ? (
        <Spinner label="Calculating reports…" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            <StatCard
              label="Total sales"
              value={formatPeso(metrics.sales)}
              icon={TrendingUp}
              tone="emerald"
              hint="Paid orders"
            />
            <StatCard
              label="Orders in period"
              value={metrics.totalOrders}
              icon={ShoppingBag}
              tone="brand"
            />
            <StatCard
              label="Completed orders"
              value={metrics.completed}
              icon={BarChart3}
              tone="emerald"
            />
            <StatCard
              label="Cancelled orders"
              value={metrics.cancelled}
              icon={XCircle}
              tone="rose"
            />
            <StatCard
              label="Stripe collected"
              value={formatPeso(metrics.stripePaid)}
              icon={CreditCard}
              tone="violet"
            />
            <StatCard
              label="Cash collected"
              value={formatPeso(metrics.codPaid)}
              icon={Banknote}
              tone="amber"
            />
            <StatCard
              label="Average sale"
              value={formatPeso(metrics.average)}
              icon={TrendingUp}
              tone="cyan"
              hint="Per paid order"
            />
            <StatCard
              label="Cash pending"
              value={formatPeso(metrics.codUncollectedAmount)}
              icon={Banknote}
              tone="rose"
              hint={`${metrics.codUncollectedCount} delivered COD order(s)`}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="p-5 xl:col-span-2">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Daily sales
                  </h2>
                  <p className="text-xs text-slate-400">
                    Paid orders, grouped by payment date
                  </p>
                </div>
                <BarChart3 className="h-4 w-4 text-slate-400" />
              </div>

              {metrics.daily.length === 0 ? (
                <div className="mt-4">
                  <EmptyState
                    icon={BarChart3}
                    title="No paid sales"
                    description="Paid orders will be summarized here as soon as payment settles."
                  />
                </div>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[420px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <th className="px-3 py-2.5">Date</th>
                        <th className="px-3 py-2.5">Orders</th>
                        <th className="px-3 py-2.5 text-right">Sales</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {metrics.daily.map((day) => (
                        <tr key={day.date}>
                          <td className="px-3 py-2.5 text-slate-600">
                            {format(parseISO(day.date), 'EEE, MMM d, yyyy')}
                          </td>
                          <td className="px-3 py-2.5 text-slate-600">
                            {day.orders}
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold text-slate-900">
                            {formatPeso(day.sales)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card className="p-5">
              <h2 className="text-sm font-semibold text-slate-900">
                Payment method summary
              </h2>
              <p className="text-xs text-slate-400">
                All orders created in this period
              </p>

              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-4">
                  <div className="flex items-center gap-2 text-violet-800">
                    <CreditCard className="h-4 w-4" />
                    <p className="text-sm font-semibold">Stripe online</p>
                  </div>
                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    {metrics.stripeOrders}
                  </p>
                  <p className="text-xs text-slate-500">
                    orders · {formatPeso(metrics.stripePaid)} collected
                  </p>
                </div>

                <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-4">
                  <div className="flex items-center gap-2 text-amber-800">
                    <Banknote className="h-4 w-4" />
                    <p className="text-sm font-semibold">Cash on Delivery</p>
                  </div>
                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    {metrics.codOrders}
                  </p>
                  <p className="text-xs text-slate-500">
                    orders · {formatPeso(metrics.codPaid)} collected
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-500">
                  <p>
                    <span className="font-semibold text-slate-700">
                      {metrics.paidOrders}
                    </span>{' '}
                    paid order(s) in this period. Cash pending is only counted
                    for delivered orders, so it reflects money still to be
                    collected.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
