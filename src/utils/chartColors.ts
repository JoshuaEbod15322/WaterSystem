import type { OrderStatus } from '../types'

/** Hex colors for SVG charts, matching the app's status badge palette. */
export const ORDER_STATUS_CHART_COLORS: Record<OrderStatus, string> = {
  pending: '#f59e0b',
  out_for_delivery: '#06b6d4',
  delivered: '#10b981',
  cancelled: '#f43f5e',
}

export const PAYMENT_METHOD_CHART_COLORS = {
  stripe: '#8b5cf6',
  cod: '#f59e0b',
} as const
