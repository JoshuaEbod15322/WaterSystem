import type {
  ContainerType,
  DistancePricingRule,
  OrderCalculationInput,
} from '../types'
import { roundMoney } from './money'

export interface OrderTotals {
  waterSubtotal: number
  containerSubtotal: number
  deliveryFee: number
  total: number
}

export function calculateOrderTotals({
  waterQuantity,
  containerType,
  waterPrice,
  containerPrice,
  deliveryFee,
}: OrderCalculationInput): OrderTotals {
  const quantity = Math.max(0, Math.floor(waterQuantity || 0))
  const waterSubtotal = roundMoney(waterPrice * quantity)
  const containerSubtotal =
    containerType === 'new' ? roundMoney(containerPrice * quantity) : 0
  const fee = roundMoney(deliveryFee)

  return {
    waterSubtotal,
    containerSubtotal,
    deliveryFee: fee,
    total: roundMoney(waterSubtotal + containerSubtotal + fee),
  }
}

export function findDistanceRule(
  distanceKm: number | null | undefined,
  rules: DistancePricingRule[],
): DistancePricingRule | null {
  if (distanceKm === null || distanceKm === undefined) return null
  return (
    rules.find(
      (rule) =>
        rule.is_active &&
        distanceKm >= Number(rule.min_km) &&
        (rule.max_km === null || distanceKm < Number(rule.max_km)),
    ) ?? null
  )
}

/**
 * Returns the minimum number of 19L containers required for a distance.
 * A null result means no active rule covers the distance.
 */
export function minimumQuantityForDistance(
  distanceKm: number | null | undefined,
  rules: DistancePricingRule[],
): number | null {
  const rule = findDistanceRule(distanceKm, rules)
  return rule ? Number(rule.min_quantity) : null
}

export function describeRange(minKm: number, maxKm: number | null): string {
  if (maxKm === null) return `Above ${formatKm(minKm)}`
  if (minKm === 0) return `0 – ${formatKm(maxKm)}`
  return `Above ${formatKm(minKm)} – ${formatKm(maxKm)}`
}

export function formatKm(value: number): string {
  return `${Number(value).toLocaleString('en-PH', {
    maximumFractionDigits: 2,
  })} km`
}

export function describeContainerType(type: ContainerType): string {
  return type === 'new' ? 'New container purchase' : 'Empty container exchange'
}
