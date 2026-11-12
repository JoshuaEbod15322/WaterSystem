import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Mail,
  MapPin,
  Phone,
  Search,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react'
import type { OrderWithRelations, Profile } from '../../types'
import { listCustomers, setProfileActive } from '../../services/drivers'
import { listAdminOrders } from '../../services/orders'
import { useToast } from '../../contexts/ToastContext'
import { getErrorMessage } from '../../utils/errors'
import { formatDateTime } from '../../utils/dates'
import { formatPeso } from '../../utils/money'
import {
  Alert,
  Card,
  ConfirmDialog,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Spinner,
  StatCard,
} from '../../components/common/ui'
import { Button } from '../../components/common/Button'
import { OrderStatusBadge } from '../../components/common/StatusBadges'

export function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Profile[]>([])
  const [orders, setOrders] = useState<OrderWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Profile | null>(null)
  const [toggleTarget, setToggleTarget] = useState<Profile | null>(null)
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      const [nextCustomers, nextOrders] = await Promise.all([
        listCustomers(),
        listAdminOrders(),
      ])
      setCustomers(nextCustomers)
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

  const ordersByCustomer = useMemo(() => {
    const map = new Map<string, OrderWithRelations[]>()
    orders.forEach((order) => {
      const list = map.get(order.customer_id) ?? []
      list.push(order)
      map.set(order.customer_id, list)
    })
    return map
  }, [orders])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return customers
    return customers.filter(
      (customer) =>
        customer.full_name.toLowerCase().includes(term) ||
        customer.email.toLowerCase().includes(term) ||
        (customer.phone ?? '').toLowerCase().includes(term) ||
        (customer.address ?? '').toLowerCase().includes(term),
    )
  }, [customers, search])

  const activeCount = customers.filter((customer) => customer.is_active).length

  const handleToggle = async () => {
    if (!toggleTarget) return
    setSaving(true)
    try {
      await setProfileActive(toggleTarget.id, !toggleTarget.is_active)
      toast.success(
        `${toggleTarget.full_name} has been ${
          toggleTarget.is_active ? 'deactivated' : 'reactivated'
        }.`,
      )
      setToggleTarget(null)
      await load(true)
    } catch (toggleError) {
      toast.error(getErrorMessage(toggleError))
    } finally {
      setSaving(false)
    }
  }

  const selectedOrders = selected
    ? ordersByCustomer.get(selected.id) ?? []
    : []
  const selectedSpent = selectedOrders
    .filter(
      (order) =>
        order.order_status === 'delivered' && order.payment_status === 'paid',
    )
    .reduce((sum, order) => sum + Number(order.total_amount), 0)

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Accounts"
        title="Customer management"
        description="View customer accounts, order history and account status. Customer accounts are created through public signup only."
      />

      {error ? (
        <Alert tone="error" title="Could not load customers">
          {error}
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Customers" value={customers.length} icon={Users} />
        <StatCard
          label="Active accounts"
          value={activeCount}
          icon={UserCheck}
          tone="emerald"
        />
        <StatCard
          label="Deactivated"
          value={customers.length - activeCount}
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
            placeholder="Search by name, email or phone"
            className="pl-9"
            aria-label="Search customers"
          />
        </div>
      </Card>

      {loading && customers.length === 0 ? (
        <Spinner label="Loading customers…" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search ? 'No matching customers' : 'No customers yet'}
          description={
            search
              ? 'Try a different name, email or phone number.'
              : 'Customers appear here after they sign up through the public registration page.'
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Orders</th>
                  <th className="px-4 py-3">Total spent</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((customer) => {
                  const customerOrders =
                    ordersByCustomer.get(customer.id) ?? []
                  const spent = customerOrders
                    .filter(
                      (order) =>
                        order.order_status === 'delivered' &&
                        order.payment_status === 'paid',
                    )
                    .reduce((sum, order) => sum + Number(order.total_amount), 0)
                  return (
                    <tr key={customer.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                            {customer.full_name.charAt(0).toUpperCase() || 'C'}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">
                              {customer.full_name || 'Unnamed customer'}
                            </p>
                            <p className="text-xs text-slate-400">
                              Joined {formatDateTime(customer.created_at)}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="flex items-center gap-1.5 text-slate-600">
                          <Mail className="h-3.5 w-3.5 text-slate-400" />
                          {customer.email}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
                          <Phone className="h-3 w-3" />
                          {customer.phone || 'No phone'}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 font-medium text-slate-700">
                        {customerOrders.length}
                      </td>
                      <td className="px-4 py-3.5 font-medium text-slate-700">
                        {formatPeso(spent)}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                            customer.is_active
                              ? 'bg-emerald-100 text-emerald-800 ring-emerald-200'
                              : 'bg-slate-100 text-slate-600 ring-slate-200'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              customer.is_active
                                ? 'bg-emerald-500'
                                : 'bg-slate-400'
                            }`}
                          />
                          {customer.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelected(customer)}
                          >
                            View
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setToggleTarget(customer)}
                          >
                            {customer.is_active ? 'Deactivate' : 'Activate'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.full_name ?? 'Customer'}
        description="Customer profile and order history"
        size="lg"
        footer={
          <Button variant="outline" onClick={() => setSelected(null)}>
            Close
          </Button>
        }
      >
        {selected ? (
          <div className="space-y-5">
            <div className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
              <p className="flex items-center gap-2 text-slate-600">
                <Mail className="h-4 w-4 text-slate-400" />
                {selected.email}
              </p>
              <p className="flex items-center gap-2 text-slate-600">
                <Phone className="h-4 w-4 text-slate-400" />
                {selected.phone || 'No phone on record'}
              </p>
              <p className="flex items-start gap-2 text-slate-600 sm:col-span-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                {selected.address || 'No saved address'}
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Order history
                </p>
                <p className="text-xs text-slate-400">
                  {selectedOrders.length} order(s) · {formatPeso(selectedSpent)}{' '}
                  paid
                </p>
              </div>
              <Link
                to={`/admin/orders?customer=${selected.id}`}
                className="text-xs font-semibold text-brand-700 hover:text-brand-800"
              >
                Open filtered orders →
              </Link>
            </div>

            {selectedOrders.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No orders yet"
                description="This customer has not placed an order."
              />
            ) : (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                {selectedOrders.slice(0, 12).map((order) => (
                  <li
                    key={order.id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div>
                      <Link
                        to={`/admin/orders/${order.id}`}
                        className="text-sm font-semibold text-slate-900 hover:text-brand-700"
                      >
                        {order.order_code}
                      </Link>
                      <p className="text-xs text-slate-400">
                        {order.delivery_date} · {order.water_quantity} × 19L ·{' '}
                        {formatPeso(order.total_amount)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <OrderStatusBadge status={order.order_status} />
                      <Link
                        to={`/admin/orders/${order.id}`}
                        className="text-xs font-semibold text-brand-700"
                      >
                        View
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(toggleTarget)}
        title={
          toggleTarget?.is_active
            ? 'Deactivate customer?'
            : 'Reactivate customer?'
        }
        message={
          toggleTarget?.is_active
            ? `${toggleTarget.full_name} will no longer be able to sign in or place orders. Existing orders are kept.`
            : `${toggleTarget?.full_name} will be able to sign in and place orders again.`
        }
        confirmLabel={toggleTarget?.is_active ? 'Deactivate' : 'Reactivate'}
        tone={toggleTarget?.is_active ? 'danger' : 'primary'}
        loading={saving}
        onConfirm={() => void handleToggle()}
        onClose={() => setToggleTarget(null)}
      />
    </div>
  )
}
