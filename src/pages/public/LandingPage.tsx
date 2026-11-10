import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clock,
  CreditCard,
  Droplets,
  MapPin,
  Menu,
  Phone,
  Route,
  ShieldCheck,
  Truck,
  X,
} from "lucide-react";
import { Logo } from "../../components/common/Logo";
import { SetupNotice } from "../../components/common/SetupNotice";
import { Button } from "../../components/common/Button";
import { usePublicConfig } from "../../hooks/usePublicConfig";
import { formatPeso } from "../../utils/money";
import { describeRange, formatKm } from "../../utils/calculations";
import { formatTimeRange } from "../../utils/dates";
import { CONTAINER_SHORT_LABELS } from "../../utils/constants";

const NAV_ITEMS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#why-us", label: "Why choose us" },
  { href: "#minimum-order", label: "Delivery area" },
  { href: "#station", label: "Station" },
  { href: "#faq", label: "FAQ" },
];

const STEPS = [
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
    text: "Follow the status from pending to out for delivery and all the way to your doorstep.",
  },
];

const FEATURES = [
  {
    icon: ShieldCheck,
    title: "Purified & sealed",
    text: "Refilled and sealed at the station with clean, great-tasting 19L water.",
  },
  {
    icon: Clock,
    title: "Scheduled windows",
    text: "Pick a date and two-hour delivery window that fits your day.",
  },
  {
    icon: CreditCard,
    title: "Pay your way",
    text: "Pay online by card during checkout, or choose Cash on Delivery.",
  },
  {
    icon: Truck,
    title: "Track every stop",
    text: "Follow your order from pending to out for delivery to your doorstep.",
  },
];

const FAQS = [
  {
    question: "How do delivery schedules work?",
    answer:
      "Choose an available date and two-hour delivery window at checkout. Every window has limited slots, so it is best to book early.",
  },
  {
    question: "What is the minimum order?",
    answer:
      "It depends on the road distance from the station. Checkout automatically shows the required number of 19L containers based on your pinned location.",
  },
  {
    question: "Should I exchange or buy a container?",
    answer:
      "Exchange an empty 19L container at no extra container cost, or buy a new one that you keep. Both options are available on every order.",
  },
  {
    question: "How can I pay?",
    answer:
      "Pay online by card during checkout, or choose Cash on Delivery and pay the rider when the water arrives.",
  },
  {
    question: "Can I cancel an order?",
    answer:
      "Yes, while the order is still pending and unpaid. Cancelling releases your delivery slot immediately.",
  },
];

export function LandingPage() {
  const { config, loading, error } = usePublicConfig();
  const [mobileOpen, setMobileOpen] = useState(false);

  const stationName =
    config?.station.station_name ?? "AquaDrop Water Refilling Station";
  const stationAddress =
    config?.station.address ??
    "Dona Maria, Iligan City, Lanao del Norte, Philippines";
  const stationHours =
    config?.station.operating_hours ?? "Mon-Sat: 7:00 AM - 6:00 PM";

  return (
    <div className="min-h-screen bg-white">
      <SetupNotice />

      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />

          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-500 lg:flex">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="transition hover:text-slate-900"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <Link to="/login">
              <Button variant="ghost">Sign in</Button>
            </Link>
            <Link to="/signup">
              <Button>Create account</Button>
            </Link>
          </div>

          <button
            type="button"
            className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 lg:hidden"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileOpen}
            aria-controls="landing-mobile-nav"
          >
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>

        {mobileOpen ? (
          <div
            id="landing-mobile-nav"
            className="border-t border-slate-100 bg-white px-4 py-4 lg:hidden"
          >
            <nav className="flex flex-col gap-1 text-sm font-medium text-slate-600">
              {NAV_ITEMS.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg px-3 py-2.5 transition hover:bg-slate-50 hover:text-slate-900"
                >
                  {item.label}
                </a>
              ))}
              <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3">
                <Link to="/login" onClick={() => setMobileOpen(false)}>
                  <Button variant="outline" fullWidth>
                    Sign in
                  </Button>
                </Link>
                <Link to="/signup" onClick={() => setMobileOpen(false)}>
                  <Button fullWidth>Create account</Button>
                </Link>
              </div>
            </nav>
          </div>
        ) : null}
      </header>

      <main>
        <section className="relative overflow-hidden bg-slate-950">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(56,166,248,0.35),transparent_40%),radial-gradient(circle_at_85%_70%,rgba(20,184,166,0.3),transparent_45%)]" />
          <div className="relative mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-24">
            <div>
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
                    Exchange your empty container at no extra cost, or purchase
                    a new container that you keep.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section
          id="how-it-works"
          className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16 sm:px-6 lg:py-24"
        >
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">
                How it works
              </p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                From tap to doorstep in four steps
              </h2>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-500">
                We keep the whole process simple: pin your delivery point,
                choose your water, book a window, and track the rider as your
                order moves.
              </p>

              <ul className="mt-6 space-y-3 text-sm text-slate-600">
                {[
                  "No app download required",
                  "Cancel while pending and unpaid",
                  "Live status updates until delivery",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    {item}
                  </li>
                ))}
              </ul>

              <Link to="/signup" className="mt-7 inline-flex">
                <Button
                  variant="secondary"
                  icon={<ArrowRight className="h-4 w-4" />}
                >
                  Start an order
                </Button>
              </Link>
            </div>

            <ol className="relative ml-4 border-l border-slate-200">
              {STEPS.map((step, index) => (
                <li key={step.title} className="relative pb-10 pl-10 last:pb-0">
                  <span className="absolute -left-5 top-0 flex h-10 w-10 items-center justify-center rounded-full border-4 border-white bg-brand-600 text-xs font-bold text-white shadow-sm">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-200 hover:shadow-md">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                        <step.icon className="h-5 w-5" />
                      </span>
                      <h3 className="text-base font-semibold text-slate-900">
                        {step.title}
                      </h3>
                    </div>
                    <p className="mt-2.5 text-sm leading-relaxed text-slate-500">
                      {step.text}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          id="why-us"
          className="scroll-mt-24 bg-slate-50 py-16 lg:py-20"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">
                Why choose us
              </p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                Simple, reliable water delivery
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-500">
                Everything you need for a smoother refill day, without the
                guesswork.
              </p>
            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-200 hover:shadow-md"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                    <feature.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-sm font-semibold text-slate-900">
                    {feature.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                    {feature.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="minimum-order"
          className="scroll-mt-24 bg-white py-16 lg:py-20"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">
                  Delivery area
                </p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                  Distance based minimum orders
                </h2>
                <p className="mt-3 max-w-lg text-sm leading-relaxed text-slate-500">
                  We use actual road distance from the station not a straight
                  line to keep delivery efficient. Your required minimum is
                  calculated automatically when you pin your address at
                  checkout.
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

        <section
          id="station"
          className="scroll-mt-24 bg-slate-50 py-16 lg:py-20"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid gap-8  border-slate-200 p-6 sm:p-8 lg:grid-cols-2">
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

              <div className="rounded-2xl bg-white border shadow-sm border-slate-200 p-5">
                <p className="text-sm font-semibold text-slate-900">
                  Delivery windows
                </p>
                <div className="mt-3 space-y-2.5">
                  {loading ? (
                    <div className="h-5 w-2/3 animate-pulse rounded bg-slate-300" />
                  ) : (
                    Array.from(
                      new Set(
                        config?.schedules.map(
                          (schedule) => schedule.start_time,
                        ) ?? [],
                      ),
                    ).map((startTime) => {
                      const matching = config?.schedules.find(
                        (schedule) => schedule.start_time === startTime,
                      );
                      if (!matching) return null;
                      return (
                        <div
                          key={startTime}
                          className="flex items-center justify-between rounded-lg bg-slate-100/50 px-3.5 py-2.5 text-sm"
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
          </div>
        </section>

        <section id="faq" className="scroll-mt-24 bg-white py-16 lg:py-20">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">
                FAQ
              </p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
                Questions, answered
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-500">
                Quick answers about scheduling, containers, payment, and
                cancellations.
              </p>
            </div>

            <div className="mt-8 space-y-3">
              {FAQS.map((faq) => (
                <details
                  key={faq.question}
                  className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm open:border-brand-200"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
                    {faq.question}
                    <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-slate-500">
                    {faq.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-slate-950 text-slate-300">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr]">
          <div>
            <Logo light />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-400">
              Simple, scheduled delivery of purified 19L drinking water in
              Iligan City. Pin your location, choose a delivery window, and
              we&apos;ll take care of the rest.
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Quick links
            </p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {NAV_ITEMS.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="text-slate-400 transition hover:text-white"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
              <li>
                <Link
                  to="/login"
                  className="text-slate-400 transition hover:text-white"
                >
                  Sign in
                </Link>
              </li>
              <li>
                <Link
                  to="/signup"
                  className="text-slate-400 transition hover:text-white"
                >
                  Create account
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Contact
            </p>
            <ul className="mt-4 space-y-3 text-sm text-slate-400">
              <li className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />
                {stationAddress}
              </li>
              <li className="flex items-start gap-3">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" />
                {stationHours}
              </li>
              {/* TODO: Add the phone and hotline numbers here once available. */}
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:px-6">
            <p>
              © {new Date().getFullYear()} {stationName}. All rights reserved.
            </p>
            <p>Built for scheduled water delivery.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
