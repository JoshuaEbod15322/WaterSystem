import type {
  OrderStatus,
  PaymentStatus,
  UserRole,
} from '../../types'
import {
  ORDER_STATUS_META,
  PAYMENT_STATUS_META,
  ROLE_LABELS,
} from '../../utils/constants'
import { Badge } from './ui'

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const meta = ORDER_STATUS_META[status] ?? ORDER_STATUS_META.pending
  return (
    <Badge className={meta.badge}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </Badge>
  )
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const meta = PAYMENT_STATUS_META[status] ?? PAYMENT_STATUS_META.pending
  return <Badge className={meta.badge}>{meta.label}</Badge>
}

export function RoleBadge({ role }: { role: UserRole }) {
  const styles: Record<UserRole, string> = {
    admin: 'bg-slate-900 text-white ring-slate-900',
    driver: 'bg-violet-100 text-violet-800 ring-violet-200',
    customer: 'bg-brand-100 text-brand-800 ring-brand-200',
  }
  return <Badge className={styles[role]}>{ROLE_LABELS[role]}</Badge>
}
