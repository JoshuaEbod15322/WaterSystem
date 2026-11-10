import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Crosshair,
  Navigation,
  Package,
  RefreshCw,
} from 'lucide-react'
import type { LatLng } from '../../types'
import { useAuth } from '../../contexts/AuthContext'
import { useDriverLocation } from '../../hooks/useDriverLocation'
import type { DriverLocationStatus } from '../../hooks/useDriverLocation'
import { useDriverOrders } from '../../hooks/useDriverOrders'
import { formatPeso } from '../../utils/money'
import { Alert, Card, Spinner } from '../../components/common/ui'
import { Button } from '../../components/common/Button'
import { DeliveryOverviewMap } from '../../components/driver/DeliveryOverviewMap'
import { DriverOrderCard } from '../../components/driver/DriverOrderCard'

const GPS_COPY: Record<
  DriverLocationStatus,
  { title: string; description: string; iconClass: string }
> = {
  idle: {
    title: 'Location sharing is off',
    description:
      'Tap Enable GPS so the station can see your latest position while you deliver. Location is only shared while this page is open.',
    iconClass: 'bg-slate-100 text-slate-500',
  },
  requesting: {
    title: 'Waiting for location permission…',
    description: 'Approve the browser prompt to share your live position.',
    iconClass: 'bg-amber-100 text-amber-700',
  },
  active: {
    title: 'GPS sharing is on',
    description:
      'The station can see your latest position. Tap Stop sharing when you are done.',
    iconClass: 'bg-emerald-100 text-emerald-700',
  },
  denied: {
    title: 'Location permission denied',
    description:
      'Allow location access in your browser settings, then tap Try again.',
    iconClass: 'bg-rose-100 text-rose-700',
  },
  error: {
    title: 'Could not start GPS',
    description: 'Your current location could not be determined.',
    iconClass: 'bg-amber-100 text-amber-700',
  },
}

export function DriverActiveRoutePage() {
  const { profile } = useAuth()
  const { position, error: gpsError, status, start, stop } = useDriverLocation(
    profile?.id,
  )
  const { orders, station, loading, error, load } = useDriverOrders(profile?.id)

  const activeOrders = useMemo(
    () =>
      orders
        .filter((order) => order.order_status === 'out_for_delivery')
        .sort((a, b) =>
          `${a.delivery_date}${a.delivery_time}`.localeCompare(
            `${b.delivery_date}${b.delivery_time}`,
          ),
        ),
    [orders],
  )

  const todayKey = format(new Date(), 'yyyy-MM-dd')
  const todayOrders = activeOrders.filter(
    (order) => order.delivery_date === todayKey,
  )
  const upcomingOrders = activeOrders.filter(
    (order) => order.delivery_date !== todayKey,
  )

  const cashToCollect = activeOrders
    .filter(
      (order) =>
        order.payment_method === 'cod' && order.payment_status !== 'paid',
    )
    .reduce((sum, order) => sum + Number(order.total_amount), 0)

  const stationPoint = station
    ? { lat: station.latitude, lng: station.longitude }
    : null

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600">
            Live route
          </p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">
            Active Route
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          icon={<RefreshCw className="h-3.5 w-3.5" />}
          onClick={() => void load(true)}
        >
          Refresh
        </Button>
      </div>

      <GpsControl
        status={status}
        error={gpsError}
        position={position}
        onStart={start}
        onStop={stop}
      />

      {error ? (
        <Alert tone="error" title="Could not load your route">
          {error}
        </Alert>
      ) : null}

      {loading && orders.length === 0 ? (
        <Spinner label="Loading your active route…" />
      ) : activeOrders.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
            <Navigation className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900">
              No active deliveries
            </p>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              Accept a pending customer order and it will appear here as a stop
              on your route.
            </p>
          </div>
          <Link to="/driver">
            <Button variant="secondary">Browse pending orders</Button>
          </Link>
        </Card>
      ) : (
        <>
          <Card className="p-3">
            <DeliveryOverviewMap
              station={stationPoint}
              driver={position}
              orders={activeOrders}
              heightClass="h-64"
            />
          </Card>

          {cashToCollect > 0 ? (
            <div className="flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3 text-white">
              <span className="flex items-center gap-2 text-xs font-medium text-slate-300">
                <Package className="h-4 w-4" />
                Cash to collect on this route
              </span>
              <span className="text-base font-bold text-emerald-300">
                {formatPeso(cashToCollect)}
              </span>
            </div>
          ) : null}

          {todayOrders.length > 0 ? (
            <section className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Due today
                </h2>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                  <Clock className="h-3 w-3" />
                  {todayOrders.length} stop{todayOrders.length === 1 ? '' : 's'}
                </span>
              </div>
              {todayOrders.map((order) => (
                <DriverOrderCard key={order.id} order={order} />
              ))}
            </section>
          ) : null}

          {upcomingOrders.length > 0 ? (
            <section className="space-y-2">
              <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Upcoming
              </h2>
              {upcomingOrders.map((order) => (
                <DriverOrderCard key={order.id} order={order} />
              ))}
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}

function GpsControl({
  status,
  error,
  position,
  onStart,
  onStop,
}: {
  status: DriverLocationStatus
  error: string | null
  position: LatLng | null
  onStart: () => void
  onStop: () => void
}) {
  const copy = GPS_COPY[status]
  const Icon =
    status === 'active'
      ? CheckCircle2
      : status === 'denied' || status === 'error'
        ? AlertCircle
        : Crosshair

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${copy.iconClass}`}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">{copy.title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
              {status === 'denied' || status === 'error'
                ? error ?? copy.description
                : copy.description}
            </p>
            {status === 'active' && position ? (
              <p className="mt-1 font-mono text-[10px] text-slate-400">
                {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
              </p>
            ) : null}
          </div>
        </div>

        {status === 'idle' ? (
          <Button
            size="sm"
            icon={<Crosshair className="h-3.5 w-3.5" />}
            onClick={onStart}
          >
            Enable GPS
          </Button>
        ) : status === 'requesting' ? (
          <Button size="sm" variant="outline" loading>
            Requesting…
          </Button>
        ) : status === 'active' ? (
          <Button size="sm" variant="outline" onClick={onStop}>
            Stop sharing
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            icon={<RefreshCw className="h-3.5 w-3.5" />}
            onClick={onStart}
          >
            Try again
          </Button>
        )}
      </div>
    </Card>
  )
}
