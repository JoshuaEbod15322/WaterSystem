import { useCallback, useEffect, useState } from 'react'
import {
  Calculator,
  Droplets,
  PackagePlus,
  RefreshCw,
  Save,
  Truck,
} from 'lucide-react'
import type { PricingSettings } from '../../types'
import {
  getPricingSettings,
  updatePricingSettings,
} from '../../services/settings'
import { useToast } from '../../contexts/ToastContext'
import { getErrorMessage } from '../../utils/errors'
import { calculateOrderTotals } from '../../utils/calculations'
import { formatPeso } from '../../utils/money'
import {
  Alert,
  Card,
  Field,
  Input,
  PageHeader,
  Spinner,
  StatCard,
} from '../../components/common/ui'
import { Button } from '../../components/common/Button'

export function AdminPricingPage() {
  const [pricing, setPricing] = useState<PricingSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [waterPrice, setWaterPrice] = useState('0')
  const [containerPrice, setContainerPrice] = useState('0')
  const [deliveryFee, setDeliveryFee] = useState('0')
  const toast = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const next = await getPricingSettings()
      setPricing(next)
      setWaterPrice(String(next.water_price))
      setContainerPrice(String(next.container_price))
      setDeliveryFee(String(next.delivery_fee))
    } catch (loadError) {
      setError(getErrorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleSave = async () => {
    const water = Number(waterPrice)
    const container = Number(containerPrice)
    const fee = Number(deliveryFee)

    if (
      !Number.isFinite(water) ||
      !Number.isFinite(container) ||
      !Number.isFinite(fee) ||
      water < 0 ||
      container < 0 ||
      fee < 0
    ) {
      toast.error('All prices must be valid non-negative amounts.')
      return
    }

    setSaving(true)
    try {
      const updated = await updatePricingSettings({
        water_price: water,
        container_price: container,
        delivery_fee: fee,
      })
      setPricing(updated)
      toast.success('Prices updated. Existing orders keep their original prices.')
    } catch (saveError) {
      toast.error(getErrorMessage(saveError))
    } finally {
      setSaving(false)
    }
  }

  const totals = calculateOrderTotals({
    waterQuantity: 2,
    containerType: 'new',
    waterPrice: Number(waterPrice) || 0,
    containerPrice: Number(containerPrice) || 0,
    deliveryFee: Number(deliveryFee) || 0,
  })

  const exchangeTotals = calculateOrderTotals({
    waterQuantity: 2,
    containerType: 'exchange',
    waterPrice: Number(waterPrice) || 0,
    containerPrice: Number(containerPrice) || 0,
    deliveryFee: Number(deliveryFee) || 0,
  })

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Configuration"
        title="Price management"
        description="Set the current 19L water price, new container price and flat delivery fee. Prices are always recalculated on the server when an order is placed."
        actions={
          <Button
            variant="outline"
            icon={<RefreshCw className="h-4 w-4" />}
            onClick={() => void load()}
          >
            Refresh
          </Button>
        }
      />

      {error ? (
        <Alert tone="error" title="Could not load pricing">
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <Spinner label="Loading pricing…" />
      ) : pricing ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard
              label="Water refill"
              value={formatPeso(pricing.water_price)}
              icon={Droplets}
              hint="Per 19L container"
            />
            <StatCard
              label="New container"
              value={formatPeso(pricing.container_price)}
              icon={PackagePlus}
              tone="violet"
              hint="Added per new container"
            />
            <StatCard
              label="Delivery fee"
              value={formatPeso(pricing.delivery_fee)}
              icon={Truck}
              tone="amber"
              hint="Flat fee per order"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="text-base font-semibold text-slate-900">
                Current prices
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Last updated {new Date(pricing.updated_at).toLocaleString()}
              </p>

              <div className="mt-5 space-y-4">
                <Field
                  label="19L water refill price (₱)"
                  htmlFor="water-price"
                  hint="Charged for every container, whether exchange or new."
                  required
                >
                  <Input
                    id="water-price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={waterPrice}
                    onChange={(event) => setWaterPrice(event.target.value)}
                  />
                </Field>

                <Field
                  label="New 19L container price (₱)"
                  htmlFor="container-price"
                  hint="Added only when the customer chooses to purchase new containers."
                  required
                >
                  <Input
                    id="container-price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={containerPrice}
                    onChange={(event) => setContainerPrice(event.target.value)}
                  />
                </Field>

                <Field
                  label="Delivery fee (₱)"
                  htmlFor="delivery-fee"
                  hint="Flat delivery fee applied to each order."
                  required
                >
                  <Input
                    id="delivery-fee"
                    type="number"
                    min="0"
                    step="0.01"
                    value={deliveryFee}
                    onChange={(event) => setDeliveryFee(event.target.value)}
                  />
                </Field>

                <Button
                  onClick={() => void handleSave()}
                  loading={saving}
                  icon={<Save className="h-4 w-4" />}
                >
                  Save prices
                </Button>
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-brand-600" />
                <h2 className="text-base font-semibold text-slate-900">
                  Price examples
                </h2>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Live preview using the values in the form (before saving).
              </p>

              <div className="mt-5 space-y-4">
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-sm font-semibold text-slate-900">
                    Exchange empty containers
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    2 × {formatPeso(Number(waterPrice) || 0)} water
                  </p>
                  <div className="mt-3 space-y-1.5 text-sm">
                    <div className="flex justify-between text-slate-500">
                      <span>Water subtotal</span>
                      <span>{formatPeso(exchangeTotals.waterSubtotal)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Container subtotal</span>
                      <span>{formatPeso(0)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Delivery fee</span>
                      <span>{formatPeso(exchangeTotals.deliveryFee)}</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-100 pt-2 font-semibold text-slate-900">
                      <span>Total</span>
                      <span>{formatPeso(exchangeTotals.total)}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-4">
                  <p className="text-sm font-semibold text-slate-900">
                    Purchase new containers
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    2 × ({formatPeso(Number(waterPrice) || 0)} water +{' '}
                    {formatPeso(Number(containerPrice) || 0)} container)
                  </p>
                  <div className="mt-3 space-y-1.5 text-sm">
                    <div className="flex justify-between text-slate-500">
                      <span>Water subtotal</span>
                      <span>{formatPeso(totals.waterSubtotal)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Container subtotal</span>
                      <span>{formatPeso(totals.containerSubtotal)}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Delivery fee</span>
                      <span>{formatPeso(totals.deliveryFee)}</span>
                    </div>
                    <div className="flex justify-between border-t border-brand-200 pt-2 font-semibold text-slate-900">
                      <span>Total</span>
                      <span>{formatPeso(totals.total)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <Alert tone="info" title="Historical orders are protected" >
                Each order stores the water price, container price and delivery
                fee used at the time it was placed. Changing prices never
                changes completed or pending orders.
              </Alert>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  )
}
