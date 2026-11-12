import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format, subDays } from "date-fns";
import {
  Activity,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Package,
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
import { getErrorMessage } from "../../utils/errors";
import { ORDER_STATUS_CHART_COLORS } from "../../utils/chartColors";
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
import { DonutChart } from "../../components/charts/DonutChart";

interface DashboardData {
  orders: OrderWithRelations[];
  counts: OrderCounts;
  sales: number;
  paidSales: PaidSale[];
}

const RECENT_ORDERS_PER_PAGE = 5;

export function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recentPage, setRecentPage] = useState(1);

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

  const recentTotal = data?.orders.length ?? 0;
  const recentPageCount = Math.max(
    1,
    Math.ceil(recentTotal / RECENT_ORDERS_PER_PAGE),
  );
  const recentOrders = useMemo(() => {
    const start = (recentPage - 1) * RECENT_ORDERS_PER_PAGE;
    return (
      data?.orders.slice(start, start + RECENT_ORDERS_PER_PAGE) ?? []
    );
  }, [data?.orders, recentPage]);
  const recentStart =
    recentTotal === 0 ? 0 : (recentPage - 1) * RECENT_ORDERS_PER_PAGE + 1;
  const recentEnd = Math.min(
    recentPage * RECENT_ORDERS_PER_PAGE,
    recentTotal,
  );

  useEffect(() => {
    setRecentPage((page) => Math.min(page, recentPageCount));
  }, [recentPageCount]);

  const statusSegments = useMemo(
    () => [
      {
        label: "Pending",
        value: data?.counts.pending ?? 0,
        color: ORDER_STATUS_CHART_COLORS.pending,
      },
      {
        label: "Out for delivery",
        value: data?.counts.active ?? 0,
        color: ORDER_STATUS_CHART_COLORS.out_for_delivery,
      },
      {
        label: "Delivered",
        value: data?.counts.completed ?? 0,
        color: ORDER_STATUS_CHART_COLORS.delivered,
      },
      {
        label: "Cancelled",
        value: data?.counts.cancelled ?? 0,
        color: ORDER_STATUS_CHART_COLORS.cancelled,
      },
    ],
    [data?.counts],
  );

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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Station overview"
        title="Admin dashboard"
        description="Live snapshot of orders and sales for the station."
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              {recentTotal > 0 ? (
                <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-slate-500">
                    Showing{" "}
                    <span className="font-semibold text-slate-700">
                      {recentStart}–{recentEnd}
                    </span>{" "}
                    of{" "}
                    <span className="font-semibold text-slate-700">
                      {recentTotal}
                    </span>{" "}
                    orders
                  </p>
                  {recentPageCount > 1 ? (
                    <div className="flex items-center justify-between gap-2 sm:justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<ChevronLeft className="h-3.5 w-3.5" />}
                        disabled={recentPage === 1}
                        onClick={() =>
                          setRecentPage((page) => Math.max(1, page - 1))
                        }
                      >
                        Previous
                      </Button>
                      <span className="text-xs font-medium text-slate-500">
                        Page{" "}
                        <span className="font-semibold text-slate-700">
                          {recentPage}
                        </span>{" "}
                        of {recentPageCount}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<ChevronRight className="h-3.5 w-3.5" />}
                        disabled={recentPage === recentPageCount}
                        onClick={() =>
                          setRecentPage((page) =>
                            Math.min(recentPageCount, page + 1),
                          )
                        }
                      >
                        Next
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </Card>

            <Card className="p-4">
              <h2 className="text-sm font-semibold text-slate-900">
                Order status overview
              </h2>
              <p className="text-xs text-slate-400">
                Distribution of all orders
              </p>
              <div className="mt-4 flex flex-col items-center gap-5">
                <DonutChart
                  segments={statusSegments}
                  centerValue={data.counts.total}
                  centerLabel="Orders"
                />
                <ul className="w-full space-y-2.5">
                  {statusSegments.map((segment) => {
                    const percentage = data.counts.total
                      ? Math.round((segment.value / data.counts.total) * 100)
                      : 0;
                    return (
                      <li
                        key={segment.label}
                        className="flex items-center justify-between gap-3 text-xs"
                      >
                        <span className="flex items-center gap-2 text-slate-600">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: segment.color }}
                          />
                          {segment.label}
                        </span>
                        <span className="font-semibold tabular-nums text-slate-900">
                          {segment.value}
                          <span className="ml-1 font-normal text-slate-400">
                            ({percentage}%)
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
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
