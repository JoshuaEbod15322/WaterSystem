import type {
  ContainerType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  UserRole,
} from '../types'

export const APP_NAME = 'AquaDrop'
export const PRODUCT_NAME = '19L Purified Drinking Water'

export const DEFAULT_CENTER = { lat: 8.208918, lng: 124.245123 }

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrator',
  driver: 'Delivery Driver',
  customer: 'Customer',
}

export const ROLE_HOME: Record<UserRole, string> = {
  admin: '/admin',
  driver: '/driver',
  customer: '/customer',
}

export const ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'out_for_delivery',
  'delivered',
  'cancelled',
]

export const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; badge: string; dot: string; description: string }
> = {
  pending: {
    label: 'Pending',
    badge: 'bg-amber-100 text-amber-800 ring-amber-200',
    dot: 'bg-amber-500',
    description: 'Waiting for a driver to accept the order.',
  },
  out_for_delivery: {
    label: 'Out for Delivery',
    badge: 'bg-cyan-100 text-cyan-800 ring-cyan-200',
    dot: 'bg-cyan-500',
    description: 'The driver is on the way to your address.',
  },
  delivered: {
    label: 'Delivered',
    badge: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
    dot: 'bg-emerald-500',
    description: 'The order has been delivered.',
  },
  cancelled: {
    label: 'Cancelled',
    badge: 'bg-rose-100 text-rose-800 ring-rose-200',
    dot: 'bg-rose-500',
    description: 'This order was cancelled.',
  },
}

export const PAYMENT_STATUS_META: Record<
  PaymentStatus,
  { label: string; badge: string }
> = {
  pending: { label: 'Unpaid', badge: 'bg-amber-100 text-amber-800 ring-amber-200' },
  paid: { label: 'Paid', badge: 'bg-emerald-100 text-emerald-800 ring-emerald-200' },
  failed: { label: 'Failed', badge: 'bg-rose-100 text-rose-800 ring-rose-200' },
  refunded: { label: 'Refunded', badge: 'bg-slate-100 text-slate-700 ring-slate-200' },
}

export const CONTAINER_LABELS: Record<ContainerType, string> = {
  exchange: 'Exchange empty container',
  new: 'Purchase new container',
}

export const CONTAINER_SHORT_LABELS: Record<ContainerType, string> = {
  exchange: 'Exchange',
  new: 'New container',
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  stripe: 'Online card payment',
  cod: 'Cash on Delivery',
}

export const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]

/** Orders that still need to be delivered. */
export const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'out_for_delivery',
]

export const DELIVERY_DAYS_AHEAD = 14
