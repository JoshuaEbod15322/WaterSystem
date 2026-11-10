import { Link } from 'react-router-dom'
import { ChevronRight, Inbox } from 'lucide-react'
import type { OrderWithRelations } from '../../types'
import { CONTAINER_SHORT_LABELS } from '../../utils/constants'
import { formatDeliveryDate } from '../../utils/dates'
import { formatPeso } from '../../utils/money'
import {
  OrderStatusBadge,
  PaymentStatusBadge,
} from '../common/StatusBadges'
import { EmptyState } from '../common/ui'

export function OrderTable({
  orders,
  emptyTitle = 'No orders yet',
  emptyDescription = 'Orders will appear here as customers place them.',
  showPayment = true,
}: {
  orders: OrderWithRelations[]
  emptyTitle?: string
  emptyDescription?: string
  showPayment?: boolean
}) {
  if (orders.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title={emptyTitle}
        description={emptyDescription}
      />
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-4 py-3">Order</th>
            <th className="px-4 py-3">Customer</th>
            <th className="px-4 py-3">Delivery</th>
            <th className="px-4 py-3">Amount</th>
            {showPayment ? <th className="px-4 py-3">Payment</th> : null}
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {orders.map((order) => (
            <tr key={order.id} className="transition hover:bg-slate-50/80">
              <td className="px-4 py-3.5">
                <p className="font-semibold text-slate-900">{order.order_code}</p>
                <p className="text-xs text-slate-400">
                  {order.water_quantity} × 19L ·{' '}
                  {CONTAINER_SHORT_LABELS[order.container_type]}
                </p>
              </td>
              <td className="px-4 py-3.5">
                <p className="font-medium text-slate-800">
                  {order.customer_name || order.customer?.full_name || 'Customer'}
                </p>
                <p className="text-xs text-slate-400">
                  {order.customer_phone || order.customer?.phone || 'No phone'}
                </p>
              </td>
              <td className="px-4 py-3.5">
                <p className="font-medium text-slate-700">
                  {formatDeliveryDate(order.delivery_date)}
                </p>
                <p className="text-xs text-slate-400">{order.delivery_time}</p>
              </td>
              <td className="px-4 py-3.5">
                <p className="font-semibold text-slate-900">
                  {formatPeso(order.total_amount)}
                </p>
                <p className="text-xs capitalize text-slate-400">
                  {order.payment_method === 'cod' ? 'Cash on Delivery' : 'Stripe'}
                </p>
              </td>
              {showPayment ? (
                <td className="px-4 py-3.5">
                  <PaymentStatusBadge status={order.payment_status} />
                </td>
              ) : null}
              <td className="px-4 py-3.5">
                <OrderStatusBadge status={order.order_status} />
              </td>
              <td className="px-4 py-3.5 text-right">
                <Link
                  to={`/admin/orders/${order.id}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800"
                >
                  View
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
