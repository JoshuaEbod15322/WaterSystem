import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Mail,
  Phone,
  Plus,
  Search,
  // ShieldCheck,
  Truck,
  UserCheck,
  UserX,
} from "lucide-react";
import type { OrderWithRelations, Profile } from "../../types";
import { listDrivers, setProfileActive } from "../../services/drivers";
import { listAdminOrders } from "../../services/orders";
import { useToast } from "../../contexts/ToastContext";
import { getErrorMessage } from "../../utils/errors";
import {
  Alert,
  Card,
  ConfirmDialog,
  EmptyState,
  Input,
  PageHeader,
  Spinner,
  StatCard,
} from "../../components/common/ui";
import { Button } from "../../components/common/Button";
import { DriverFormModal } from "../../components/admin/DriverFormModal";

export function AdminDriversPage() {
  const [drivers, setDrivers] = useState<Profile[]>([]);
  const [orders, setOrders] = useState<OrderWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Profile | null>(null);
  const [toggleTarget, setToggleTarget] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [nextDrivers, nextOrders] = await Promise.all([
        listDrivers(),
        listAdminOrders(),
      ]);
      setDrivers(nextDrivers);
      setOrders(nextOrders);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const driverStats = useMemo(() => {
    const map = new Map<
      string,
      { active: number; delivered: number; total: number }
    >();
    orders.forEach((order) => {
      if (!order.driver_id) return;
      const current = map.get(order.driver_id) ?? {
        active: 0,
        delivered: 0,
        total: 0,
      };
      current.total += 1;
      if (order.order_status === "delivered") current.delivered += 1;
      if (order.order_status === "out_for_delivery") {
        current.active += 1;
      }
      map.set(order.driver_id, current);
    });
    return map;
  }, [orders]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return drivers;
    return drivers.filter(
      (driver) =>
        driver.full_name.toLowerCase().includes(term) ||
        driver.email.toLowerCase().includes(term) ||
        (driver.phone ?? "").toLowerCase().includes(term),
    );
  }, [drivers, search]);

  const activeCount = drivers.filter((driver) => driver.is_active).length;

  const handleToggle = async () => {
    if (!toggleTarget) return;
    setSaving(true);
    try {
      await setProfileActive(toggleTarget.id, !toggleTarget.is_active);
      toast.success(
        `${toggleTarget.full_name} has been ${
          toggleTarget.is_active ? "deactivated" : "reactivated"
        }.`,
      );
      setToggleTarget(null);
      await load(true);
    } catch (toggleError) {
      toast.error(getErrorMessage(toggleError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Delivery team"
        title="Driver management"
        description="Create driver accounts, manage access and review delivery activity. Only administrators can create driver logins."
        actions={
          <Button
            icon={<Plus className="h-4 w-4" />}
            onClick={() => {
              setEditingDriver(null);
              setFormOpen(true);
            }}
          >
            Create driver
          </Button>
        }
      />

      {error ? (
        <Alert tone="error" title="Could not load drivers">
          {error}
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Drivers" value={drivers.length} icon={Truck} />
        <StatCard
          label="Active"
          value={activeCount}
          icon={UserCheck}
          tone="emerald"
        />
        <StatCard
          label="Deactivated"
          value={drivers.length - activeCount}
          icon={UserX}
          tone="rose"
        />
      </div>

      <Card className="p-4">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search drivers"
            className="pl-9"
            aria-label="Search drivers"
          />
        </div>
      </Card>

      {loading && drivers.length === 0 ? (
        <Spinner label="Loading drivers…" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Truck}
          title={search ? "No matching drivers" : "No drivers yet"}
          description={
            search
              ? "Try a different name, email or phone number."
              : "Create the first driver account so drivers can accept pending deliveries."
          }
          action={
            !search ? (
              <Button
                icon={<Plus className="h-4 w-4" />}
                onClick={() => {
                  setEditingDriver(null);
                  setFormOpen(true);
                }}
              >
                Create driver
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((driver) => {
            const stats = driverStats.get(driver.id) ?? {
              active: 0,
              delivered: 0,
              total: 0,
            };
            return (
              <Card key={driver.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-violet-100 text-base font-bold text-violet-700">
                      {driver.full_name.charAt(0).toUpperCase() || "D"}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">
                        {driver.full_name}
                      </p>
                      <p className="text-xs text-slate-400">
                        {driver.is_active ? "Active driver" : "Deactivated"}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                      driver.is_active
                        ? "bg-emerald-100 text-emerald-800 ring-emerald-200"
                        : "bg-slate-100 text-slate-600 ring-slate-200"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        driver.is_active ? "bg-emerald-500" : "bg-slate-400"
                      }`}
                    />
                    {driver.is_active ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="mt-4 space-y-1.5 text-xs text-slate-500">
                  <p className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                    {driver.email}
                  </p>
                  <p className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    {driver.phone || "No phone"}
                  </p>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center">
                  <div>
                    <p className="text-lg font-bold text-slate-900">
                      {stats.active}
                    </p>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                      Active
                    </p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-slate-900">
                      {stats.delivered}
                    </p>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                      Delivered
                    </p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-slate-900">
                      {stats.total}
                    </p>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
                      Total
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingDriver(driver);
                      setFormOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setToggleTarget(driver)}
                  >
                    {driver.is_active ? "Deactivate" : "Activate"}
                  </Button>
                  <Link
                    to={`/admin/orders?driver=${driver.id}`}
                    className="inline-flex h-9 items-center rounded-lg px-3 text-sm font-semibold text-brand-700 hover:bg-brand-50"
                  >
                    View orders
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <DriverFormModal
        open={formOpen}
        driver={editingDriver}
        onClose={() => setFormOpen(false)}
        onSaved={() => void load(true)}
      />

      <ConfirmDialog
        open={Boolean(toggleTarget)}
        title={
          toggleTarget?.is_active ? "Deactivate driver?" : "Reactivate driver?"
        }
        message={
          toggleTarget?.is_active
            ? `${toggleTarget.full_name} will no longer be able to sign in or update deliveries. Existing delivery history is kept.`
            : `${toggleTarget?.full_name} will be able to sign in and receive deliveries again.`
        }
        confirmLabel={toggleTarget?.is_active ? "Deactivate" : "Reactivate"}
        tone={toggleTarget?.is_active ? "danger" : "primary"}
        loading={saving}
        onConfirm={() => void handleToggle()}
        onClose={() => setToggleTarget(null)}
      />
    </div>
  );
}
