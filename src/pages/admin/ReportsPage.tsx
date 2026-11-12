import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Banknote,
  BarChart3,
  CreditCard,
  Printer,
  ShoppingBag,
  TrendingUp,
  XCircle,
} from "lucide-react";
import {
  format,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths,
} from "date-fns";
import type { OrderStatus, OrderWithRelations } from "../../types";
import { getAllOrdersForReports } from "../../services/reports";
import { useRealtimeRefresh } from "../../hooks/useRealtimeRefresh";
import { getErrorMessage } from "../../utils/errors";
import {
  ORDER_STATUS_CHART_COLORS,
  PAYMENT_METHOD_CHART_COLORS,
} from "../../utils/chartColors";
import {
  APP_NAME,
  ORDER_STATUSES,
  ORDER_STATUS_META,
} from "../../utils/constants";
import { formatPeso } from "../../utils/money";
import {
  Alert,
  Card,
  PageHeader,
  Spinner,
  StatCard,
} from "../../components/common/ui";
import { Button } from "../../components/common/Button";
import { BarChart } from "../../components/charts/BarChart";
import { DonutChart } from "../../components/charts/DonutChart";
import { LineChart } from "../../components/charts/LineChart";

type RangeKey = "today" | "7d" | "30d" | "month" | "all";

const rangeLabels: Record<RangeKey, string> = {
  today: "Today",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  month: "This month",
  all: "All time",
};

function rangeStart(key: RangeKey): Date | null {
  const now = new Date();
  if (key === "today") return startOfDay(now);
  if (key === "7d") return startOfDay(subDays(now, 6));
  if (key === "30d") return startOfDay(subDays(now, 29));
  if (key === "month") return startOfMonth(now);
  return null;
}

function trendRangeLabel(key: RangeKey): string {
  if (key === "today" || key === "7d") return "Last 7 days";
  if (key === "30d") return "Last 30 days";
  if (key === "month") return "This month";
  return "Last 12 months";
}

interface TrendBucket {
  key: string;
  label: string;
  orders: number;
  sales: number;
}

function buildTrendBuckets(range: RangeKey): TrendBucket[] {
  const now = new Date();

  if (range === "all") {
    return Array.from({ length: 12 }, (_, index) => {
      const date = startOfMonth(subMonths(now, 11 - index));
      return {
        key: format(date, "yyyy-MM"),
        label: format(date, "MMM yy"),
        orders: 0,
        sales: 0,
      };
    });
  }

  const days =
    range === "today" || range === "7d"
      ? 7
      : range === "30d"
        ? 30
        : now.getDate();

  return Array.from({ length: days }, (_, index) => {
    const date = startOfDay(subDays(now, days - 1 - index));
    return {
      key: format(date, "yyyy-MM-dd"),
      label: format(date, days > 14 ? "d" : "MMM d"),
      orders: 0,
      sales: 0,
    };
  });
}

function trendKey(value: string | null | undefined, monthly: boolean) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return format(date, monthly ? "yyyy-MM" : "yyyy-MM-dd");
}

export function AdminReportsPage() {
  const [orders, setOrders] = useState<OrderWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<RangeKey>("30d");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      setOrders(await getAllOrdersForReports());
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

  const filtered = useMemo(() => {
    const start = rangeStart(range);
    if (!start) return orders;
    return orders.filter((order) => {
      const createdAt = new Date(order.created_at);
      return createdAt >= start;
    });
  }, [orders, range]);

  const metrics = useMemo(() => {
    const completed = filtered.filter(
      (order) => order.order_status === "delivered",
    );
    const paidOrders = filtered.filter(
      (order) => order.payment_status === "paid",
    );
    const cancelled = filtered.filter(
      (order) => order.order_status === "cancelled",
    );
    const sales = paidOrders.reduce(
      (sum, order) => sum + Number(order.total_amount),
      0,
    );
    const stripePaid = paidOrders
      .filter((order) => order.payment_method === "stripe")
      .reduce((sum, order) => sum + Number(order.total_amount), 0);
    const codPaid = paidOrders
      .filter((order) => order.payment_method === "cod")
      .reduce((sum, order) => sum + Number(order.total_amount), 0);
    const codUncollected = completed.filter(
      (order) =>
        order.payment_method === "cod" && order.payment_status === "pending",
    );
    const codUncollectedAmount = codUncollected.reduce(
      (sum, order) => sum + Number(order.total_amount),
      0,
    );

    const statusCounts: Record<OrderStatus, number> = {
      pending: 0,
      out_for_delivery: 0,
      delivered: 0,
      cancelled: 0,
    };
    filtered.forEach((order) => {
      statusCounts[order.order_status] += 1;
    });

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
      statusCounts,
      codOrders: filtered.filter((order) => order.payment_method === "cod")
        .length,
      stripeOrders: filtered.filter(
        (order) => order.payment_method === "stripe",
      ).length,
      paidOrders: paidOrders.length,
    };
  }, [filtered]);

  const trend = useMemo(() => {
    const buckets = buildTrendBuckets(range);
    const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
    const monthly = range === "all";

    filtered.forEach((order) => {
      const createdBucket = byKey.get(
        trendKey(order.created_at, monthly) ?? "",
      );
      if (createdBucket) createdBucket.orders += 1;

      if (order.payment_status !== "paid") return;
      const paidAt = Array.isArray(order.payments)
        ? order.payments[0]?.paid_at ?? null
        : null;
      const salesBucket = byKey.get(
        trendKey(paidAt ?? order.updated_at ?? order.created_at, monthly) ?? "",
      );
      if (salesBucket) salesBucket.sales += Number(order.total_amount);
    });

    return buckets;
  }, [filtered, range]);

  const salesBars = useMemo(
    () =>
      trend.map((bucket) => ({
        key: bucket.key,
        label: bucket.label,
        value: bucket.sales,
        caption: `${bucket.orders} order${bucket.orders === 1 ? "" : "s"}`,
      })),
    [trend],
  );

  const orderPoints = useMemo(
    () =>
      trend.map((bucket) => ({
        key: bucket.key,
        label: bucket.label,
        value: bucket.orders,
      })),
    [trend],
  );

  const statusSegments = useMemo(
    () =>
      ORDER_STATUSES.map((status) => ({
        label: ORDER_STATUS_META[status].label,
        value: metrics.statusCounts[status],
        color: ORDER_STATUS_CHART_COLORS[status],
      })),
    [metrics.statusCounts],
  );

  const paymentSegments = useMemo(
    () => [
      {
        label: "Stripe online",
        value: metrics.stripeOrders,
        collected: metrics.stripePaid,
        color: PAYMENT_METHOD_CHART_COLORS.stripe,
      },
      {
        label: "Cash on Delivery",
        value: metrics.codOrders,
        collected: metrics.codPaid,
        color: PAYMENT_METHOD_CHART_COLORS.cod,
      },
    ],
    [
      metrics.codOrders,
      metrics.codPaid,
      metrics.stripeOrders,
      metrics.stripePaid,
    ],
  );

  const tableRows = useMemo(
    () =>
      [...trend]
        .filter((bucket) => bucket.orders > 0 || bucket.sales > 0)
        .reverse(),
    [trend],
  );

  const averagePerBucket = trend.length
    ? metrics.totalOrders / trend.length
    : 0;
  const trendUnit = range === "all" ? "month" : "day";

  return (
    <div className="space-y-5">
      <div className="print:hidden">
        <PageHeader
          eyebrow="Insights"
          title="Sales reports"
          description="Simple sales, order and payment summaries based on orders created in the selected period."
          actions={
            <Button
              variant="outline"
              icon={<Printer className="h-4 w-4" />}
              onClick={() => window.print()}
              disabled={loading}
            >
              Print / PDF
            </Button>
          }
        />
      </div>

      <div className="flex flex-wrap gap-2 print:hidden">
        {(Object.keys(rangeLabels) as RangeKey[]).map((key) => (
          <Button
            key={key}
            size="sm"
            variant={range === key ? "primary" : "outline"}
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 print:hidden">
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

          <div className="grid gap-4 xl:grid-cols-3 print:hidden">
            <Card className="p-5 xl:col-span-2">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Daily sales
                  </h2>
                  <p className="text-xs text-slate-400">
                    Paid sales by payment date · {trendRangeLabel(range)}
                  </p>
                </div>
                <BarChart3 className="h-4 w-4 text-slate-400" />
              </div>

              <div className="mt-4">
                <BarChart
                  data={salesBars}
                  formatValue={formatPeso}
                  color="#2089ed"
                  emptyLabel="No paid sales in this period yet."
                />
              </div>

              {tableRows.length > 0 ? (
                <details className="group mt-4 rounded-xl border border-slate-200">
                  <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-xs font-semibold text-slate-600 [&::-webkit-details-marker]:hidden">
                    View exact values
                    <span className="text-[10px] font-normal text-slate-400 group-open:hidden">
                      {tableRows.length} row(s)
                    </span>
                  </summary>
                  <div className="overflow-x-auto border-t border-slate-100">
                    <table className="w-full min-w-[420px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          <th className="px-3 py-2.5">Date</th>
                          <th className="px-3 py-2.5">Orders</th>
                          <th className="px-3 py-2.5 text-right">Sales</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {tableRows.map((bucket) => (
                          <tr key={bucket.key}>
                            <td className="px-3 py-2.5 text-slate-600">
                              {bucket.label}
                            </td>
                            <td className="px-3 py-2.5 text-slate-600">
                              {bucket.orders}
                            </td>
                            <td className="px-3 py-2.5 text-right font-semibold text-slate-900">
                              {formatPeso(bucket.sales)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              ) : null}
            </Card>

            <Card className="p-5">
              <h2 className="text-sm font-semibold text-slate-900">
                Order status breakdown
              </h2>
              <p className="text-xs text-slate-400">
                All orders created in this period
              </p>

              <div className="mt-4 flex flex-col items-center gap-5">
                <DonutChart
                  segments={statusSegments}
                  centerValue={metrics.totalOrders}
                  centerLabel="Orders"
                />
                <ul className="w-full space-y-2.5">
                  {statusSegments.map((segment) => {
                    const percentage = metrics.totalOrders
                      ? Math.round((segment.value / metrics.totalOrders) * 100)
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

          <div className="grid gap-4 xl:grid-cols-3 print:hidden">
            <Card className="p-5 xl:col-span-2">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Orders trend
                  </h2>
                  <p className="text-xs text-slate-400">
                    Orders created per {trendUnit} · {trendRangeLabel(range)}
                  </p>
                </div>
                <Activity className="h-4 w-4 text-slate-400" />
              </div>

              <div className="mt-4">
                <LineChart
                  data={orderPoints}
                  formatValue={(value) =>
                    `${value} order${value === 1 ? "" : "s"}`
                  }
                  color="#0284c7"
                  emptyLabel="No orders created in this period yet."
                />
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Total orders
                  </p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums text-slate-900">
                    {metrics.totalOrders}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Average per {trendUnit}
                  </p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums text-slate-900">
                    {averagePerBucket.toFixed(1)}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <h2 className="text-sm font-semibold text-slate-900">
                Payment method split
              </h2>
              <p className="text-xs text-slate-400">
                Orders created in this period
              </p>

              <div className="mt-4 flex flex-col items-center gap-5">
                <DonutChart
                  segments={paymentSegments}
                  centerValue={metrics.totalOrders}
                  centerLabel="Orders"
                />
                <ul className="w-full space-y-3">
                  {paymentSegments.map((segment) => (
                    <li
                      key={segment.label}
                      className="rounded-xl border border-slate-200 px-3 py-2.5"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="flex items-center gap-2 font-semibold text-slate-700">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: segment.color }}
                          />
                          {segment.label}
                        </span>
                        <span className="font-bold tabular-nums text-slate-900">
                          {segment.value}
                        </span>
                      </div>
                      <p className="mt-1 pl-4 text-[11px] text-slate-500">
                        {formatPeso(segment.collected)} collected
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          </div>

          <section className="hidden print:mt-0 print:block print:text-[11pt] print:text-slate-900">
            <div className="print-section border-b border-slate-300 pb-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {APP_NAME}
              </p>
              <h1 className="mt-1 text-xl font-bold text-slate-900">
                Sales report
              </h1>
              <p className="mt-1 text-xs text-slate-600">
                Period: {rangeLabels[range]} · Generated{" "}
                {format(new Date(), "MMM d, yyyy · h:mm a")}
              </p>
            </div>

            <div className="print-section">
              <h2 className="mb-2 text-sm font-bold text-slate-900">Summary</h2>
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-300 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="py-1.5 pr-3">Metric</th>
                    <th className="py-1.5 text-right">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {[
                    ["Total sales", formatPeso(metrics.sales)],
                    ["Orders in period", String(metrics.totalOrders)],
                    ["Completed orders", String(metrics.completed)],
                    ["Cancelled orders", String(metrics.cancelled)],
                    ["Stripe collected", formatPeso(metrics.stripePaid)],
                    ["Cash collected", formatPeso(metrics.codPaid)],
                    ["Average sale", formatPeso(metrics.average)],
                    ["Cash pending", formatPeso(metrics.codUncollectedAmount)],
                    [
                      `Average orders per ${trendUnit}`,
                      averagePerBucket.toFixed(1),
                    ],
                  ].map(([label, value]) => (
                    <tr key={label}>
                      <td className="py-1.5 pr-3 text-slate-700">{label}</td>
                      <td className="py-1.5 text-right font-semibold tabular-nums text-slate-900">
                        {value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="print-section">
              <h2 className="mb-2 text-sm font-bold text-slate-900">
                Daily sales
              </h2>
              {tableRows.length > 0 ? (
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-300 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="py-1.5 pr-3">Date</th>
                      <th className="py-1.5 pr-3 text-right">Orders</th>
                      <th className="py-1.5 text-right">Sales</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {tableRows.map((bucket) => (
                      <tr key={bucket.key}>
                        <td className="py-1.5 pr-3 text-slate-700">
                          {bucket.label}
                        </td>
                        <td className="py-1.5 pr-3 text-right tabular-nums text-slate-700">
                          {bucket.orders}
                        </td>
                        <td className="py-1.5 text-right font-semibold tabular-nums text-slate-900">
                          {formatPeso(bucket.sales)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-slate-600">
                  No paid sales in this period.
                </p>
              )}
            </div>

            <div className="print-section">
              <h2 className="mb-2 text-sm font-bold text-slate-900">
                Order status breakdown
              </h2>
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-300 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="py-1.5 pr-3">Status</th>
                    <th className="py-1.5 pr-3 text-right">Orders</th>
                    <th className="py-1.5 text-right">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {statusSegments.map((segment) => (
                    <tr key={segment.label}>
                      <td className="py-1.5 pr-3 text-slate-700">
                        {segment.label}
                      </td>
                      <td className="py-1.5 pr-3 text-right tabular-nums text-slate-700">
                        {segment.value}
                      </td>
                      <td className="py-1.5 text-right font-semibold tabular-nums text-slate-900">
                        {metrics.totalOrders
                          ? Math.round(
                              (segment.value / metrics.totalOrders) * 100,
                            )
                          : 0}
                        %
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="print-section">
              <h2 className="mb-2 text-sm font-bold text-slate-900">
                Payment method split
              </h2>
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-300 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="py-1.5 pr-3">Method</th>
                    <th className="py-1.5 pr-3 text-right">Orders</th>
                    <th className="py-1.5 text-right">Collected</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {paymentSegments.map((segment) => (
                    <tr key={segment.label}>
                      <td className="py-1.5 pr-3 text-slate-700">
                        {segment.label}
                      </td>
                      <td className="py-1.5 pr-3 text-right tabular-nums text-slate-700">
                        {segment.value}
                      </td>
                      <td className="py-1.5 text-right font-semibold tabular-nums text-slate-900">
                        {formatPeso(segment.collected)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
