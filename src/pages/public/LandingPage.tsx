import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  CreditCard,
  Droplets,
  MapPin,
  Phone,
  Route,
  ShieldCheck,
  Sparkles,
  Truck,
} from "lucide-react";
import { Logo } from "../../components/common/Logo";
import { SetupNotice } from "../../components/common/SetupNotice";
import { Button } from "../../components/common/Button";
import { usePublicConfig } from "../../hooks/usePublicConfig";
import { formatPeso } from "../../utils/money";
import { describeRange, formatKm } from "../../utils/calculations";
import { formatTimeRange } from "../../utils/dates";
import { CONTAINER_SHORT_LABELS } from "../../utils/constants";

export function LandingPage() {
  const { config, loading, error } = usePublicConfig();

  return (
    <div className="min-h-screen bg-white">
      <SetupNotice />

      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-500 md:flex">
            <a href="#how-it-works" className="hover:text-slate-900">
              How it works
            </a>
            <a href="#minimum-order" className="hover:text-slate-900">
              Delivery area
            </a>
            <a href="#station" className="hover:text-slate-900">
              Station
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login">
              <Button variant="ghost">Sign in</Button>
            </Link>
            <Link to="/signup">
              <Button>Create account</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-slate-950">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(56,166,248,0.35),transparent_40%),radial-gradient(circle_at_85%_70%,rgba(20,184,166,0.3),transparent_45%)]" />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-brand-200">
              <Sparkles className="h-3.5 w-3.5" />
              Purified 19L water, delivered
            </span>
            <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
              Never run out of
              <span className="text-brand-300"> clean water</span> again.
            </h1>
            <p className="mt-4 max-w-lg text-base leading-relaxed text-slate-300">
              Order 19-liter purified drinking water from{" "}
              {config?.station.station_name ?? "our station"}, schedule a
              delivery window, and follow your rider on the map all in one
              place.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link to="/signup">
                <Button size="lg" icon={<ArrowRight className="h-4 w-4" />}>
                  Order water now
                </Button>
              </Link>
              <Link to="/login">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/20 bg-white/5 text-white hover:bg-white/10"
                >
                  Sign in
                </Button>
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-brand-300" />
                Secure checkout
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Truck className="h-4 w-4 text-brand-300" />
                Scheduled delivery
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CreditCard className="h-4 w-4 text-brand-300" />
                Online or cash
              </span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md">
            <div className="absolute -inset-4 rounded-3xl bg-white/5 blur-xl" />
            <div className="relative rounded-3xl border border-white/10 bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                    <Droplets className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      19L Purified Drinking Water
                    </p>
                    <p className="text-xs text-slate-500">
                      Refilled and sealed at the station
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {loading ? (
                  <div className="space-y-2">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
                    <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
                  </div>
                ) : !config ? (
                  <div className="rounded-xl bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900 ring-1 ring-amber-200">
                    <p className="font-semibold">
                      Station pricing is temporarily unavailable.
                    </p>
                    <p className="mt-1">
                      {error ?? "Please refresh the page in a moment."}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                      <span className="text-sm text-slate-600">
                        Water refill price
                      </span>
                      <span className="text-lg font-bold text-slate-900">
                        {formatPeso(config.pricing.water_price)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                      <span className="text-sm text-slate-600">
                        New 19L container
                      </span>
                      <span className="text-lg font-bold text-slate-900">
                        {formatPeso(config.pricing.container_price)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                      <span className="text-sm text-slate-600">
                        Delivery fee
                      </span>
                      <span className="text-lg font-bold text-slate-900">
                        {formatPeso(config.pricing.delivery_fee)}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="mt-5 rounded-xl border border-brand-100 bg-brand-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                  Two ways to refill
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-brand-900/80">
                  Exchange your empty container at no extra cost, or purchase a
                  new container that you keep.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        className="mx-auto max-w-6xl px-4 py-16 sm:px-6"
      >
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">
            How it works
          </p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            From tap to doorstep in four steps
          </h2>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: MapPin,
              title: "Pin your location",
              text: "Drop a pin on the map so we can compute the actual road distance from the station.",
            },
            {
              icon: Droplets,
              title: "Choose your water",
              text: "Pick how many 19L containers you need and whether you will exchange or buy containers.",
            },
            {
              icon: Clock,
              title: "Schedule delivery",
              text: "Select an available date and delivery window that fits your day.",
            },
            {
              icon: Truck,
              title: "Track the delivery",
              text: "Follow the status from preparation to your doorstep and see it update live.",
            },
          ].map((step, index) => (
            <div
              key={step.title}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <step.icon className="h-5 w-5" />
                </div>
                <span className="text-xs font-bold text-slate-300">
                  0{index + 1}
                </span>
              </div>
              <h3 className="mt-4 text-sm font-semibold text-slate-900">
                {step.title}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">
                {step.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section id="minimum-order" className="bg-slate-50 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">
                Delivery area
              </p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                Distance-based minimum orders
              </h2>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-slate-500">
                We use actual road distance from the station — not a straight
                line — to keep delivery efficient. Your required minimum is
                calculated automatically when you pin your address at checkout.
              </p>
              <div className="mt-6 flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4">
                <Route className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
                <p className="text-sm text-brand-900">
                  Maximum delivery distance:{" "}
                  <span className="font-semibold">
                    {config
                      ? formatKm(config.station.max_delivery_distance_km)
                      : "—"}
                  </span>{" "}
                  from the station.
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="grid grid-cols-2 gap-4 border-b border-slate-100 bg-slate-50/80 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <span>Road distance</span>
                <span className="text-right">Minimum order</span>
              </div>
              {loading ? (
                <div className="space-y-3 p-5">
                  {[0, 1, 2].map((item) => (
                    <div
                      key={item}
                      className="h-6 animate-pulse rounded bg-slate-100"
                    />
                  ))}
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {config?.distanceRules.map((rule) => (
                    <div
                      key={rule.id}
                      className="grid grid-cols-2 gap-4 px-5 py-3.5 text-sm"
                    >
                      <span className="text-slate-600">
                        {describeRange(
                          Number(rule.min_km),
                          rule.max_km === null ? null : Number(rule.max_km),
                        )}
                      </span>
                      <span className="text-right font-semibold text-slate-900">
                        {rule.min_quantity} containers
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section id="station" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">
              Our station
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
              {config?.station.station_name ?? "Water Refilling Station"}
            </h2>
            <div className="mt-5 space-y-4 text-sm text-slate-600">
              <p className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
                {config?.station.address ??
                  "Dona Maria, Iligan City, Lanao del Norte, Philippines"}
              </p>
              <p className="flex items-start gap-3">
                <Clock className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
                {config?.station.operating_hours ??
                  "Mon-Sat: 7:00 AM - 6:00 PM"}
              </p>
              {config?.station.contact_number ? (
                <p className="flex items-start gap-3">
                  <Phone className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
                  {config.station.contact_number}
                </p>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 p-5">
            <p className="text-sm font-semibold text-slate-900">
              Delivery windows
            </p>
            <div className="mt-3 space-y-2.5">
              {loading ? (
                <div className="h-5 w-2/3 animate-pulse rounded bg-slate-200" />
              ) : (
                Array.from(
                  new Set(
                    config?.schedules.map((schedule) => schedule.start_time) ??
                      [],
                  ),
                ).map((startTime) => {
                  const matching = config?.schedules.find(
                    (schedule) => schedule.start_time === startTime,
                  );
                  if (!matching) return null;
                  return (
                    <div
                      key={startTime}
                      className="flex items-center justify-between rounded-lg bg-white px-3.5 py-2.5 text-sm"
                    >
                      <span className="text-slate-600">
                        {formatTimeRange(
                          matching.start_time,
                          matching.end_time,
                        )}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Available
                      </span>
                    </div>
                  );
                })
              )}
            </div>
            <p className="mt-3 text-xs text-slate-400">
              {config
                ? `${CONTAINER_SHORT_LABELS.exchange} or ${CONTAINER_SHORT_LABELS.new.toLowerCase()} available on every order.`
                : "Delivery windows are managed by the station administrator."}
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-slate-500 sm:flex-row sm:px-6">
          <Logo />
          <p>
            © {new Date().getFullYear()}{" "}
            {config?.station.station_name ?? "AquaDrop"}. School project — not a
            commercial service.
          </p>
        </div>
      </footer>
    </div>
  );
}
