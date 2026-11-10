import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format, subDays } from "date-fns";
import {
  Activity,
  ArrowRight,
  CreditCard,
  Package,
  RefreshCw,
} from "lucide-react";
import type { OrderWithRelations } from "../../types";
import { listAdminOrders } from "../../services/orders";
import {
  getOrderCounts,
  getPaidSales,
  type OrderCounts,
  type PaidSale,
} from "../../services/reports";
import { useRealtimeRefresh } from "../../hooks/useRealtimeRefresh";
import { useToast } from "../../contexts/ToastContext";
import { getErrorMessage } from "../../utils/errors";
import { ORDER_STATUSES, ORDER_STATUS_META } from "../../utils/constants";
import { formatShortDate } from "../../utils/dates";
import { formatPeso } from "../../utils/money";
import {
  Alert,
  Card,
  PageHeader,
  Spinner,
  StatCard,
} from "../../components/common/ui";
import { Button } from "../../components/common/Button";
import { OrderTable } from "../../components/admin/OrderTable";

interface DashboardData {
  orders: OrderWithRelations[];
  counts: OrderCounts;
  sales: number;
  paidSales: PaidSale[];
}

export function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [orders, counts, paidSales] = await Promise.all([
        listAdminOrders(),
        getOrderCounts(),
        getPaidSales(),
      ]);

      setData({
        orders,
        counts,
        sales: paidSales.reduce((sum, sale) => sum + sale.amount, 0),
        paidSales,
      });
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtimeRefresh("orders", () => void load(true));
  // A payment can settle without an order status change (online checkout), so
  // refresh the sales figures when the payments table changes too.
  useRealtimeRefresh("payments", () => void load(true));

  const recentOrders = useMemo(
    () => data?.orders.slice(0, 6) ?? [],
    [data?.orders],
  );

  const statusCounts = useMemo(() => {
    const map = new Map<string, number>();
    data?.orders.forEach((order) => {
      map.set(order.order_status, (map.get(order.order_status) ?? 0) + 1);
    });
    return map;
  }, [data?.orders]);

  // Revenue is recognised when the payment settles (online checkout or cash
  // collected on delivery), not when the order status changes.
  const dailySales = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = subDays(new Date(), 6 - index);
      return {
        key: format(date, "yyyy-MM-dd"),
        label: format(date, "EEE"),
        total: 0,
      };
    });
    const byKey = new Map(days.map((day) => [day.key, day]));

    data?.paidSales.forEach((sale) => {
      if (!sale.paid_at) return;
      const day = byKey.get(format(new Date(sale.paid_at), "yyyy-MM-dd"));
      if (day) day.total += sale.amount;
    });

    const max = Math.max(...days.map((day) => day.total), 1);
    return { days, max };
  }, [data?.paidSales]);

  const handleRefresh = async () => {
    await load(true);
    toast.success("Dashboard refreshed.");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Station overview"
        title="Admin dashboard"
        description="Live snapshot of orders and sales for the station."
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

      {error ? (
        <Alert tone="error" title="Could not load the dashboard">
          {error}
        </Alert>
      ) : null}

      {loading && !data ? (
        <Spinner label="Loading station data…" />
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:max-w-xl">
            <StatCard
              label="Total orders"
              value={data.counts.total}
              icon={Package}
              tone="brand"
            />
            <StatCard
              label="Total sales"
              value={formatPeso(data.sales)}
              icon={CreditCard}
              tone="emerald"
              hint="Paid orders"
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Recent orders
                  </h2>
                  <p className="text-xs text-slate-400">
                    Newest orders across all statuses
                  </p>
                </div>
                <Link to="/admin/orders">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<ArrowRight className="h-3.5 w-3.5" />}
                  >
                    View all
                  </Button>
                </Link>
              </div>
              <OrderTable
                orders={recentOrders}
                emptyTitle="No orders yet"
                emptyDescription="Customer orders will appear here in real time."
              />
            </Card>

            <Card className="p-4">
              <h2 className="text-sm font-semibold text-slate-900">
                Order status overview
              </h2>
              <div className="mt-4 space-y-3">
                {ORDER_STATUSES.map((status) => {
                  const count = statusCounts.get(status) ?? 0;
                  const total = Math.max(data.counts.total, 1);
                  const percentage = Math.round((count / total) * 100);
                  return (
                    <div key={status}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 text-slate-600">
                          <span
                            className={`h-2 w-2 rounded-full ${ORDER_STATUS_META[status].dot}`}
                          />
                          {ORDER_STATUS_META[status].label}
                        </span>
                        <span className="font-semibold text-slate-900">
                          {count}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full ${ORDER_STATUS_META[status].dot}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Daily sales
                </h2>
                <p className="text-xs text-slate-400">
                  Paid orders, last 7 days
                </p>
              </div>
              <Activity className="h-4 w-4 text-slate-400" />
            </div>

            <div className="mt-6 flex h-44 items-end gap-2 sm:gap-3">
              {dailySales.days.map((day) => (
                <div
                  key={day.key}
                  className="flex flex-1 flex-col items-center gap-2"
                >
                  <span className="text-[10px] font-semibold text-slate-500">
                    {day.total > 0 ? formatPeso(day.total) : ""}
                  </span>
                  <div
                    className={`w-full rounded-t-md transition-all ${
                      day.total > 0 ? "bg-brand-500" : "bg-slate-100"
                    }`}
                    style={{
                      height: `${Math.max((day.total / dailySales.max) * 120, day.total > 0 ? 8 : 4)}px`,
                    }}
                    title={`${formatShortDate(day.key)}: ${formatPeso(day.total)}`}
                  />
                  <span className="text-[11px] text-slate-400">
                    {day.label}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}
