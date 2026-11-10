import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Lock,
  Phone,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import type { Order } from '../../types'
import { getOrderById } from '../../services/orders'
import { completeCardPayment } from '../../services/payments'
import { updateOwnProfile } from '../../services/auth'
import { useAuth } from '../../contexts/AuthContext'
import { useRealtimeRefresh } from '../../hooks/useRealtimeRefresh'
import { useToast } from '../../contexts/ToastContext'
import { getErrorMessage } from '../../utils/errors'
import {
  CONTAINER_LABELS,
  PRODUCT_NAME,
} from '../../utils/constants'
import {
  formatDeliveryDate,
  formatDateTime,
} from '../../utils/dates'
import { formatPeso } from '../../utils/money'
import {
  Alert,
  Card,
  Field,
  Input,
  PageHeader,
  Spinner,
} from '../../components/common/ui'
import { Button } from '../../components/common/Button'
import { PaymentStatusBadge } from '../../components/common/StatusBadges'

type FormErrors = Partial<
  Record<
    'firstName' | 'lastName' | 'cardNumber' | 'expiry' | 'cvv' | 'phone',
    string
  >
>

function formatCardNumber(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 19)
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim()
}

function formatExpiry(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 4)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)}/${digits.slice(2)}`
}

function passesLuhn(digits: string) {
  let sum = 0
  let double = false

  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index])
    if (double) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    double = !double
  }

  return sum % 10 === 0
}

function cardBrand(digits: string) {
  if (/^4/.test(digits)) return 'Visa'
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'Mastercard'
  if (/^3[47]/.test(digits)) return 'Amex'
  if (/^6(?:011|5)/.test(digits)) return 'Discover'
  return null
}

function validate(
  firstName: string,
  lastName: string,
  cardNumber: string,
  expiry: string,
  cvv: string,
  phone: string,
): FormErrors {
  const errors: FormErrors = {}
  const digits = cardNumber.replace(/\D/g, '')

  if (!firstName.trim()) errors.firstName = 'Enter the first name on the card.'
  if (!lastName.trim()) errors.lastName = 'Enter the last name on the card.'

  if (digits.length < 13 || digits.length > 19) {
    errors.cardNumber = 'Enter a valid card number.'
  } else if (!passesLuhn(digits)) {
    errors.cardNumber = 'That card number does not look right.'
  }

  const expiryMatch = /^(\d{2})\/(\d{2})$/.exec(expiry)
  if (!expiryMatch) {
    errors.expiry = 'Use MM/YY.'
  } else {
    const month = Number(expiryMatch[1])
    const year = 2000 + Number(expiryMatch[2])
    const lastDayOfMonth = new Date(year, month, 0, 23, 59, 59)
    if (month < 1 || month > 12) {
      errors.expiry = 'Enter a month between 01 and 12.'
    } else if (lastDayOfMonth.getTime() < Date.now()) {
      errors.expiry = 'This card has expired.'
    }
  }

  if (!/^\d{3,4}$/.test(cvv)) errors.cvv = 'Enter the 3 or 4 digit CVV.'

  const phoneDigits = phone.replace(/\D/g, '')
  if (phoneDigits.length < 10 || phoneDigits.length > 15) {
    errors.phone = 'Enter a valid phone number.'
  }

  return errors
}

export function PaymentPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const { profile } = useAuth()

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [paymentError, setPaymentError] = useState<string | null>(null)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvv, setCvv] = useState('')
  const [phone, setPhone] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [processing, setProcessing] = useState(false)

  const load = useCallback(
    async (silent = false) => {
      if (!orderId) return
      if (!silent) setLoading(true)
      try {
        setOrder(await getOrderById(orderId))
        setError(null)
      } catch (loadError) {
        setError(getErrorMessage(loadError))
      } finally {
        setLoading(false)
      }
    },
    [orderId],
  )

  useEffect(() => {
    void load()
  }, [load])

  useRealtimeRefresh('orders', () => void load(true))
  useRealtimeRefresh('payments', () => void load(true))

  // Prefill the non-card fields from the customer's profile.
  useEffect(() => {
    if (!profile) return
    const [first = '', ...rest] = (profile.full_name ?? '').trim().split(' ')
    setFirstName((current) => current || first)
    setLastName((current) => current || rest.join(' '))
    setPhone((current) => current || profile.phone || '')
  }, [profile])

  const digits = useMemo(
    () => cardNumber.replace(/\D/g, ''),
    [cardNumber],
  )
  const brand = cardBrand(digits)
  const cardholder = `${firstName} ${lastName}`.trim()

  const handleSubmit = async () => {
    if (!order) return

    const nextErrors = validate(
      firstName,
      lastName,
      cardNumber,
      expiry,
      cvv,
      phone,
    )
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      toast.error('Check the highlighted fields and try again.')
      return
    }

    setProcessing(true)
    setPaymentError(null)
    try {
      // Small pause so the processing state is visible, then settle the order.
      await new Promise<void>((resolve) =>
        window.setTimeout(() => resolve(), 700),
      )
      await completeCardPayment(order.id)

      if (profile && phone.trim() && phone.trim() !== profile.phone) {
        void updateOwnProfile(profile.id, {
          full_name: profile.full_name,
          phone: phone.trim(),
          address: profile.address,
        }).catch(() => undefined)
      }

      toast.success('Payment successful.')
      navigate(`/customer/orders/${order.id}?payment=success`, {
        replace: true,
      })
    } catch (paymentFailure) {
      const message = getErrorMessage(paymentFailure)
      setPaymentError(message)
      toast.error(message)
    } finally {
      setProcessing(false)
    }
  }

  if (loading) return <Spinner label="Loading checkout…" />

  if (error || !order) {
    return (
      <div className="space-y-4">
        <Alert tone="error" title="Unable to load this order">
          {error ?? 'Order not found.'}
        </Alert>
        <Link to="/customer/orders">
          <Button variant="outline" icon={<ArrowLeft className="h-4 w-4" />}>
            Back to orders
          </Button>
        </Link>
      </div>
    )
  }

  if (order.payment_method !== 'stripe') {
    return (
      <div className="space-y-4">
        <Alert tone="warning" title="This order is Cash on Delivery">
          There is nothing to pay online for this order.
        </Alert>
        <Link to={`/customer/orders/${order.id}`}>
          <Button variant="outline">View order</Button>
        </Link>
      </div>
    )
  }

  if (order.order_status === 'cancelled') {
    return (
      <div className="space-y-4">
        <Alert tone="error" title="This order was cancelled">
          Cancelled orders cannot be paid.
        </Alert>
        <Link to={`/customer/orders/${order.id}`}>
          <Button variant="outline">View order</Button>
        </Link>
      </div>
    )
  }

  if (order.payment_status === 'paid') {
    return (
      <div className="mx-auto max-w-lg py-10 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h1 className="mt-5 text-2xl font-bold text-slate-900">
          Payment confirmed
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Order {order.order_code} has been paid. The station has been notified
          automatically.
        </p>
        <Link to={`/customer/orders/${order.id}`} className="mt-6 inline-block">
          <Button size="lg">View order</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Secure checkout"
        title="Complete your payment"
        description={`Order ${order.order_code} · ${formatPeso(order.total_amount)}`}
        actions={
          <Link to={`/customer/orders/${order.id}`}>
            <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />}>
              Back to order
            </Button>
          </Link>
        }
      />

      {paymentError ? (
        <Alert tone="error" title="Payment failed">
          {paymentError} Your card was not charged. Check the details and try
          again.
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card className="p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <CreditCard className="h-5 w-5 text-brand-600" />
            Card details
            <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
              <Lock className="h-3.5 w-3.5" />
              Encrypted checkout
            </span>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-brand-900 p-5 text-white shadow-lg">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  AquaDrop
                </p>
                <p className="text-sm font-semibold">Online payment</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {brand ?? 'Card'}
                </p>
                <CreditCard className="ml-auto mt-1 h-6 w-6 text-brand-200" />
              </div>
            </div>

            <p className="mt-7 font-mono text-lg tracking-[0.18em] text-white">
              {cardNumber || '•••• •••• •••• ••••'}
            </p>

            <div className="mt-5 flex items-end justify-between gap-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              <div className="min-w-0">
                <p>Cardholder</p>
                <p className="mt-1 truncate text-xs normal-case tracking-normal text-white">
                  {cardholder || 'Your name'}
                </p>
              </div>
              <div className="text-right">
                <p>Expires</p>
                <p className="mt-1 text-xs tracking-normal text-white">
                  {expiry || 'MM/YY'}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field
              label="First name"
              htmlFor="first-name"
              required
              error={errors.firstName}
            >
              <Input
                id="first-name"
                autoComplete="cc-given-name"
                placeholder="Maria"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
              />
            </Field>

            <Field
              label="Last name"
              htmlFor="last-name"
              required
              error={errors.lastName}
            >
              <Input
                id="last-name"
                autoComplete="cc-family-name"
                placeholder="Santos"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
              />
            </Field>

            <div className="sm:col-span-2">
              <Field
                label="Card number"
                htmlFor="card-number"
                required
                error={errors.cardNumber}
              >
                <div className="relative">
                  <Input
                    id="card-number"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    placeholder="1234 5678 9012 3456"
                    value={cardNumber}
                    onChange={(event) =>
                      setCardNumber(formatCardNumber(event.target.value))
                    }
                    className="pr-16 font-mono"
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    {brand ?? ''}
                  </span>
                </div>
              </Field>
            </div>

            <Field
              label="Expiration date"
              htmlFor="expiry"
              required
              error={errors.expiry}
            >
              <Input
                id="expiry"
                inputMode="numeric"
                autoComplete="cc-exp"
                placeholder="MM/YY"
                value={expiry}
                onChange={(event) =>
                  setExpiry(formatExpiry(event.target.value))
                }
              />
            </Field>

            <Field
              label="CVV"
              htmlFor="cvv"
              required
              error={errors.cvv}
              hint="3 digits on the back, 4 for Amex."
            >
              <Input
                id="cvv"
                type="password"
                inputMode="numeric"
                autoComplete="cc-csc"
                placeholder="•••"
                maxLength={4}
                value={cvv}
                onChange={(event) =>
                  setCvv(event.target.value.replace(/\D/g, '').slice(0, 4))
                }
              />
            </Field>

            <div className="sm:col-span-2">
              <Field
                label="Phone number"
                htmlFor="phone"
                required
                error={errors.phone}
                hint="Used to contact you about this delivery."
              >
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="0917 123 4567"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className="pl-9"
                  />
                </div>
              </Field>
            </div>
          </div>

          <div className="mt-5 flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-xs leading-relaxed text-emerald-800">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Your card details stay in this browser and are never stored by
              AquaDrop. Only the payment result is recorded on your order.
            </p>
          </div>

          <Button
            fullWidth
            size="lg"
            className="mt-5"
            loading={processing}
            onClick={() => void handleSubmit()}
            icon={<Lock className="h-4 w-4" />}
          >
            Pay {formatPeso(order.total_amount)}
          </Button>
        </Card>

        <Card className="h-fit p-5">
          <h2 className="text-sm font-semibold text-slate-900">
            Order summary
          </h2>
          <div className="mt-4 space-y-2.5 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">Product</span>
              <span className="text-right font-medium">{PRODUCT_NAME}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">Quantity</span>
              <span className="font-medium">
                {order.water_quantity} containers
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">Container</span>
              <span className="text-right font-medium">
                {CONTAINER_LABELS[order.container_type]}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">Water subtotal</span>
              <span>{formatPeso(order.water_subtotal)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">Container subtotal</span>
              <span>{formatPeso(order.container_subtotal)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">Delivery fee</span>
              <span>{formatPeso(order.delivery_fee)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-3 font-semibold">
              <span>Total</span>
              <span className="text-lg">{formatPeso(order.total_amount)}</span>
            </div>
          </div>

          <div className="mt-4 space-y-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
            <p>
              <span className="font-semibold text-slate-700">Delivery: </span>
              {formatDeliveryDate(order.delivery_date)}, {order.delivery_time}
            </p>
            <p>
              <span className="font-semibold text-slate-700">Address: </span>
              {order.delivery_address}
            </p>
            <p>
              <span className="font-semibold text-slate-700">Placed: </span>
              {formatDateTime(order.created_at)}
            </p>
            <div className="flex items-center gap-2 pt-1">
              <span className="font-semibold text-slate-700">Payment:</span>
              <PaymentStatusBadge status={order.payment_status} />
            </div>
          </div>

          <p className="mt-4 flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-400">
            <UserRound className="mt-0.5 h-3 w-3 shrink-0" />
            Paying confirms the delivery details above. The station will assign
            a driver after payment.
          </p>
        </Card>
      </div>
    </div>
  )
}
