import { Link } from 'react-router-dom'
import { ArrowRight, MapPin, Phone } from 'lucide-react'
import type { Order } from '../../types'
import { formatDeliveryDate } from '../../utils/dates'
import { formatPeso } from '../../utils/money'
import {
  CONTAINER_SHORT_LABELS,
  ORDER_STATUS_META,
} from '../../utils/constants'
import { Card } from '../common/ui'
import {
  OrderStatusBadge,
  PaymentStatusBadge,
} from '../common/StatusBadges'

/** A route stop card that links to the delivery detail page. */
export function DriverOrderCard({ order }: { order: Order }) {
  const isOutForDelivery = order.order_status === 'out_for_delivery'

  return (
    <Link to={`/driver/deliveries/${order.id}`} className="block">
      <Card
        className={`p-4 transition hover:shadow-md ${
          isOutForDelivery ? 'ring-2 ring-amber-300' : ''
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900">
              {order.order_code}
            </p>
            <p className="mt-0.5 text-xs font-medium text-slate-600">
              {order.customer_name}
            </p>
          </div>
          <OrderStatusBadge status={order.order_status} />
        </div>

        <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="line-clamp-2">{order.delivery_address}</span>
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
          <span>{formatDeliveryDate(order.delivery_date)}</span>
          <span className="text-slate-300">·</span>
          <span>{order.delivery_time}</span>
          <span className="text-slate-300">·</span>
          <span>
            {order.water_quantity} × 19L ·{' '}
            {CONTAINER_SHORT_LABELS[order.container_type]}
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-900">
              {formatPeso(order.total_amount)}
            </span>
            <PaymentStatusBadge status={order.payment_status} />
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
            {isOutForDelivery ? 'Continue' : 'View stop'}
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>

        {order.customer_phone ? (
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
            <Phone className="h-3 w-3" />
            {order.customer_phone}
            <span className="ml-auto text-slate-300">
              {ORDER_STATUS_META[order.order_status].label}
            </span>
          </p>
        ) : null}
      </Card>
    </Link>
  )
}
