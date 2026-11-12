import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Crosshair,
  Droplets,
  Loader2,
  MapPin,
  Minus,
  Plus,
  RefreshCw,
  Route,
  ShoppingCart,
  Truck,
} from "lucide-react";
import type {
  ContainerType,
  DeliverySchedule,
  LatLng,
  PaymentMethod,
  ScheduleAvailability,
} from "../../types";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { usePublicConfig } from "../../hooks/usePublicConfig";
import { createOrder } from "../../services/orders";
import { getScheduleAvailability } from "../../services/settings";
import {
  geocodeAddress,
  getBrowserLocation,
  getRoadRoute,
  reverseGeocode,
} from "../../services/maps";
import {
  calculateOrderTotals,
  minimumQuantityForDistance,
} from "../../utils/calculations";
import { DELIVERY_DAYS_AHEAD, PRODUCT_NAME } from "../../utils/constants";
import {
  buildDeliveryDates,
  dayKey,
  formatDeliveryDate,
  formatTimeRange,
  isWindowInThePast,
} from "../../utils/dates";
import { getErrorMessage } from "../../utils/errors";
import { formatPeso } from "../../utils/money";
import {
  Alert,
  Card,
  Field,
  PageHeader,
  Select,
  Textarea,
} from "../../components/common/ui";
import { Button } from "../../components/common/Button";
import { MapPicker } from "../../components/common/MapPicker";

interface ScheduleOption {
  schedule: DeliverySchedule;
  slotsLeft: number;
  full: boolean;
}

export function CustomerOrderWaterPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const {
    config,
    loading: configLoading,
    error: configError,
    reload: reloadConfig,
  } = usePublicConfig();

  const [point, setPoint] = useState<LatLng | null>(null);
  const [address, setAddress] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [defaultLookupError, setDefaultLookupError] = useState<string | null>(
    null,
  );
  const [distance, setDistance] = useState<number | null>(null);
  const [distanceState, setDistanceState] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [distanceError, setDistanceError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const [quantity, setQuantity] = useState(1);
  const [containerType, setContainerType] = useState<ContainerType>("exchange");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [scheduleId, setScheduleId] = useState<number | "">("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");
  const [instructions, setInstructions] = useState("");

  const [availability, setAvailability] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const geocodeRequest = useRef(0);
  const defaultLocationApplied = useRef(false);
  const station = useMemo(
    () =>
      config
        ? { lat: config.station.latitude, lng: config.station.longitude }
        : null,
    [config],
  );

  // Prefill the customer's saved default location once per visit.
  useEffect(() => {
    if (!profile || defaultLocationApplied.current) return;

    const savedAddress = (profile.address ?? "").trim();
    if (savedAddress) {
      setAddress((current) => current || savedAddress);
    }

    if (profile.latitude !== null && profile.longitude !== null) {
      defaultLocationApplied.current = true;
      setPoint({ lat: profile.latitude, lng: profile.longitude });
      return;
    }

    if (!savedAddress) {
      defaultLocationApplied.current = true;
      return;
    }

    const controller = new AbortController();
    setDefaultLookupError(null);

    geocodeAddress(savedAddress, controller.signal)
      .then((result) => {
        if (defaultLocationApplied.current) return;
        if (result) {
          setPoint(result);
        } else {
          setDefaultLookupError(
            "We could not locate your saved default address. Tap the map to pin your delivery location.",
          );
        }
      })
      .catch((lookupFailure) => {
        if ((lookupFailure as Error).name === "AbortError") return;
        if (!defaultLocationApplied.current) {
          setDefaultLookupError(getErrorMessage(lookupFailure));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) defaultLocationApplied.current = true;
      });

    return () => controller.abort();
  }, [profile]);

  // Road distance from the station to the selected pin.
  useEffect(() => {
    if (!point || !station) {
      setDistance(null);
      setDistanceState("idle");
      return;
    }

    const controller = new AbortController();
    setDistanceState("loading");
    setDistanceError(null);

    getRoadRoute(station, point, controller.signal)
      .then((route) => {
        setDistance(route.distanceKm);
        setDistanceState("success");
      })
      .catch((error) => {
        if ((error as Error).name === "AbortError") return;
        setDistance(null);
        setDistanceState("error");
        setDistanceError(getErrorMessage(error));
      });

    return () => controller.abort();
  }, [point, station, retryKey]);

  // Fill in the address after dropping a pin.
  useEffect(() => {
    if (!point) return;
    const controller = new AbortController();
    const requestId = ++geocodeRequest.current;
    setGeocoding(true);

    reverseGeocode(point, controller.signal)
      .then((result) => {
        if (requestId === geocodeRequest.current && result) {
          setAddress(result);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (requestId === geocodeRequest.current) setGeocoding(false);
      });

    return () => controller.abort();
  }, [point]);

  // Slot capacity for the next two weeks.
  useEffect(() => {
    if (!config) return;
    const dates = buildDeliveryDates(DELIVERY_DAYS_AHEAD);
    let cancelled = false;

    getScheduleAvailability(dates[0].value, dates[dates.length - 1].value)
      .then((rows: ScheduleAvailability[]) => {
        if (cancelled) return;
        const map: Record<string, number> = {};
        rows.forEach((row) => {
          map[dayKey(row.schedule_id, row.delivery_date)] = Number(row.booked);
        });
        setAvailability(map);
      })
      .catch(() => {
        // Capacity display is best-effort. The database validates it again.
      });

    return () => {
      cancelled = true;
    };
  }, [config]);

  const dateOptions = useMemo(() => {
    if (!config) return [];
    return buildDeliveryDates(DELIVERY_DAYS_AHEAD).filter((option) =>
      config.schedules.some(
        (schedule) =>
          schedule.day_of_week === option.dayOfWeek &&
          !isWindowInThePast(option.value, schedule.end_time),
      ),
    );
  }, [config]);

  useEffect(() => {
    if (!deliveryDate && dateOptions.length > 0) {
      setDeliveryDate(dateOptions[0].value);
    }
  }, [deliveryDate, dateOptions]);

  const scheduleOptions = useMemo<ScheduleOption[]>(() => {
    if (!config || !deliveryDate) return [];
    const weekday = new Date(`${deliveryDate}T00:00:00`).getDay();

    return config.schedules
      .filter(
        (schedule) =>
          schedule.day_of_week === weekday &&
          !isWindowInThePast(deliveryDate, schedule.end_time),
      )
      .map((schedule) => {
        const booked = availability[dayKey(schedule.id, deliveryDate)] ?? 0;
        const slotsLeft = Math.max(schedule.max_orders - booked, 0);
        return { schedule, slotsLeft, full: slotsLeft === 0 };
      });
  }, [config, deliveryDate, availability]);

  useEffect(() => {
    if (!deliveryDate) return;
    const current = scheduleOptions.find(
      (option) => option.schedule.id === scheduleId && !option.full,
    );
    if (!current) {
      setScheduleId(
        scheduleOptions.find((option) => !option.full)?.schedule.id ?? "",
      );
    }
  }, [deliveryDate, scheduleOptions, scheduleId]);

  const selectedScheduleOption = scheduleOptions.find(
    (option) => option.schedule.id === scheduleId,
  );

  const minimumQuantity = useMemo(
    () => minimumQuantityForDistance(distance, config?.distanceRules ?? []),
    [distance, config],
  );

  const maxDistance = config?.station.max_delivery_distance_km ?? 0;
  const beyondMaxDistance =
    distance !== null && maxDistance > 0 && distance > maxDistance;
  const ruleMissing = distanceState === "success" && minimumQuantity === null;
  const belowMinimum = minimumQuantity !== null && quantity < minimumQuantity;

  const totals = useMemo(() => {
    if (!config) return null;
    return calculateOrderTotals({
      waterQuantity: quantity,
      containerType,
      waterPrice: config.pricing.water_price,
      containerPrice: config.pricing.container_price,
      deliveryFee: config.pricing.delivery_fee,
    });
  }, [config, quantity, containerType]);

  const handlePick = (nextPoint: LatLng) => {
    defaultLocationApplied.current = true;
    setDefaultLookupError(null);
    setPoint(nextPoint);
    setFormError(null);
  };

  const handleUseLocation = async () => {
    try {
      const location = await getBrowserLocation();
      handlePick(location);
      toast.success("Current location selected. Adjust the pin if needed.");
    } catch (locationError) {
      toast.error(getErrorMessage(locationError));
    }
  };

  const handleSubmit = async () => {
    setFormError(null);

    if (!profile || !config) {
      setFormError("Your account or station configuration is not ready.");
      return;
    }
    if (!point) {
      setFormError("Pin your delivery location on the map.");
      return;
    }
    if (distanceState === "loading") {
      setFormError("Please wait while the road distance is calculated.");
      return;
    }
    if (distanceState === "error" || distance === null) {
      setFormError(
        "The road distance could not be calculated. Retry before placing the order.",
      );
      return;
    }
    if (beyondMaxDistance) {
      setFormError(
        `This address is ${distance} km away, beyond the maximum delivery distance of ${maxDistance} km.`,
      );
      return;
    }
    if (minimumQuantity === null) {
      setFormError(
        "No delivery minimum applies to this distance. Please contact the station.",
      );
      return;
    }
    if (belowMinimum) {
      setFormError(
        `This location requires a minimum order of ${minimumQuantity} containers. Please add ${minimumQuantity - quantity} more container(s) to continue.`,
      );
      return;
    }
    if (!address.trim()) {
      setFormError("Enter your delivery address.");
      return;
    }
    if (!deliveryDate || !selectedScheduleOption) {
      setFormError("Select an available delivery date and time window.");
      return;
    }
    if (selectedScheduleOption.full) {
      setFormError(
        "The selected delivery window is already full. Choose another.",
      );
      return;
    }

    setSubmitting(true);
    try {
      const order = await createOrder({
        customerId: profile.id,
        deliveryDate,
        deliveryScheduleId: selectedScheduleOption.schedule.id,
        deliveryAddress: address.trim(),
        deliveryLatitude: point.lat,
        deliveryLongitude: point.lng,
        deliveryInstructions: instructions.trim() || null,
        waterQuantity: quantity,
        containerType,
        deliveryDistanceKm: distance,
        paymentMethod,
      });

      if (paymentMethod === "stripe") {
        toast.success("Order created. Complete your payment to confirm it.");
        navigate(`/customer/checkout/${order.id}`);
      } else {
        toast.success("Order placed! Pay the driver when it arrives.");
        navigate(`/customer/orders/${order.id}?placed=1`);
      }
    } catch (submitError) {
      const message = getErrorMessage(submitError);
      setFormError(message);
      toast.error(message);
      // Refresh capacity after a rejected order (for example a full window).
      void getScheduleAvailability(
        buildDeliveryDates(DELIVERY_DAYS_AHEAD)[0].value,
        buildDeliveryDates(DELIVERY_DAYS_AHEAD)[DELIVERY_DAYS_AHEAD - 1].value,
      )
        .then((rows: ScheduleAvailability[]) => {
          const map: Record<string, number> = {};
          rows.forEach((row) => {
            map[dayKey(row.schedule_id, row.delivery_date)] = Number(
              row.booked,
            );
          });
          setAvailability(map);
        })
        .catch(() => undefined);
    } finally {
      setSubmitting(false);
    }
  };

  if (configLoading) {
    return (
      <div className="flex flex-col items-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
        <p className="mt-3 text-sm text-slate-500">
          Loading products and delivery rules…
        </p>
      </div>
    );
  }

  if (configError || !config) {
    return (
      <div className="space-y-4">
        <Alert tone="error" title="Could not load station configuration">
          {configError ?? "The station is not configured yet."}
        </Alert>
        <Button
          variant="outline"
          icon={<RefreshCw className="h-4 w-4" />}
          onClick={() => void reloadConfig()}
        >
          Try again
        </Button>
      </div>
    );
  }

  const canSubmit =
    Boolean(point) &&
    distanceState === "success" &&
    distance !== null &&
    !beyondMaxDistance &&
    minimumQuantity !== null &&
    !belowMinimum &&
    address.trim().length > 0 &&
    Boolean(deliveryDate) &&
    Boolean(selectedScheduleOption) &&
    !selectedScheduleOption?.full &&
    Boolean(profile) &&
    !submitting;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="New delivery"
        title="Order water"
        description="Pin your exact location, choose how many 19L containers you need and pick a delivery window."
      />

      {formError ? (
        <Alert tone="error" title="Order not placed">
          {formError}
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_370px]">
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                  <MapPin className="h-5 w-5 text-brand-600" />
                  Delivery location
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  Your saved default location is preloaded. Tap the map or drag
                  the pin to adjust it, and we calculate the road distance from
                  the station.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                icon={<Crosshair className="h-4 w-4" />}
                onClick={() => void handleUseLocation()}
              >
                Use my location
              </Button>
            </div>

            <div className="mt-4">
              <MapPicker
                value={point}
                onChange={handlePick}
                station={station ?? undefined}
                heightClass="h-72"
                zoom={14}
              />
            </div>

            {defaultLookupError ? (
              <p className="mt-2 text-xs text-amber-700">
                {defaultLookupError}
              </p>
            ) : null}

            {distanceState === "loading" ? (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2.5 text-sm text-brand-800">
                <Loader2 className="h-4 w-4 animate-spin" />
                Calculating road distance from the station…
              </div>
            ) : distanceState === "error" ? (
              <div className="mt-3">
                <Alert
                  tone="error"
                  title="Routing unavailable"
                  action={
                    <Button
                      size="sm"
                      variant="outline"
                      icon={<RefreshCw className="h-3.5 w-3.5" />}
                      onClick={() => setRetryKey((key) => key + 1)}
                    >
                      Retry
                    </Button>
                  }
                >
                  {distanceError ??
                    "The routing service could not be reached. Retry to continue."}
                </Alert>
              </div>
            ) : distanceState === "success" && distance !== null ? (
              <div className="mt-3 space-y-2">
                <div
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3.5 py-3 ${
                    beyondMaxDistance
                      ? "border-rose-200 bg-rose-50"
                      : "border-emerald-200 bg-emerald-50"
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm">
                    <Route
                      className={`h-4 w-4 ${beyondMaxDistance ? "text-rose-600" : "text-emerald-600"}`}
                    />
                    <span className="font-semibold text-slate-900">
                      {distance} km by road
                    </span>
                  </div>
                  {beyondMaxDistance ? (
                    <span className="text-xs font-medium text-rose-700">
                      Beyond the {maxDistance} km delivery limit
                    </span>
                  ) : minimumQuantity !== null ? (
                    <span className="text-xs font-medium text-emerald-800">
                      Minimum order: {minimumQuantity} containers
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-rose-700">
                      No delivery rule covers this distance
                    </span>
                  )}
                </div>

                {minimumQuantity !== null && !beyondMaxDistance ? (
                  belowMinimum ? (
                    <Alert tone="warning">
                      Your location requires a minimum order of{" "}
                      <span className="font-semibold">
                        {minimumQuantity} containers
                      </span>
                      . Please add {minimumQuantity - quantity} more
                      container(s) to continue.
                    </Alert>
                  ) : (
                    <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Your quantity meets the minimum for this distance.
                    </p>
                  )
                ) : null}

                {beyondMaxDistance ? (
                  <Alert tone="error">
                    This address is outside the station’s {maxDistance} km
                    delivery range. Move the pin closer to the station.
                  </Alert>
                ) : null}
                {ruleMissing ? (
                  <Alert tone="error">
                    No active minimum-order rule covers this distance. Ask the
                    station to update its distance rules.
                  </Alert>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-400">
                Road distance and minimum order will appear after you pin a
                location.
              </p>
            )}

            <div className="mt-4">
              <Field
                label="Delivery address"
                htmlFor="delivery-address"
                hint={
                  geocoding
                    ? "Looking up the address from your pin…"
                    : "Edit the address if the pin lookup needs adjustment."
                }
                required
              >
                <Textarea
                  id="delivery-address"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="House number, street, barangay, city"
                  className="min-h-20"
                />
              </Field>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                  <Droplets className="h-5 w-5 text-brand-600" />
                  {PRODUCT_NAME}
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  {formatPeso(config.pricing.water_price)} per 19L container
                </p>
              </div>
              <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                19 Liters
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setContainerType("exchange")}
                className={`rounded-xl border p-4 text-left transition ${
                  containerType === "exchange"
                    ? "border-brand-500 bg-brand-50 ring-2 ring-brand-100"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">
                    Exchange empty container
                  </p>
                  {containerType === "exchange" ? (
                    <CheckCircle2 className="h-4 w-4 text-brand-600" />
                  ) : null}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Return your empty 19L container and receive a filled one. No
                  container fee.
                </p>
                <p className="mt-2 text-xs font-semibold text-brand-700">
                  {formatPeso(config.pricing.water_price)} each
                </p>
              </button>

              <button
                type="button"
                onClick={() => setContainerType("new")}
                className={`rounded-xl border p-4 text-left transition ${
                  containerType === "new"
                    ? "border-brand-500 bg-brand-50 ring-2 ring-brand-100"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">
                    Purchase new container
                  </p>
                  {containerType === "new" ? (
                    <CheckCircle2 className="h-4 w-4 text-brand-600" />
                  ) : null}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Receive a filled container that you keep. The container price
                  is added for each unit.
                </p>
                <p className="mt-2 text-xs font-semibold text-brand-700">
                  {formatPeso(
                    Number(config.pricing.water_price) +
                      Number(config.pricing.container_price),
                  )}{" "}
                  each
                </p>
              </button>
            </div>

            <div className="mt-5">
              <p className="mb-1.5 text-sm font-medium text-slate-700">
                Number of containers
                {minimumQuantity !== null && !beyondMaxDistance ? (
                  <span className="ml-1.5 text-xs font-normal text-slate-400">
                    (minimum {minimumQuantity})
                  </span>
                ) : null}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center rounded-lg border border-slate-300 bg-white shadow-sm">
                  <button
                    type="button"
                    onClick={() =>
                      setQuantity((value) => Math.max(1, value - 1))
                    }
                    className="flex h-10 w-10 items-center justify-center rounded-l-lg text-slate-500 hover:bg-slate-50"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(event) =>
                      setQuantity(
                        Math.max(
                          1,
                          Math.floor(Number(event.target.value) || 1),
                        ),
                      )
                    }
                    className="h-10 w-16 border-x border-slate-200 text-center text-sm font-semibold text-slate-900 focus:outline-none"
                    aria-label="Container quantity"
                  />
                  <button
                    type="button"
                    onClick={() => setQuantity((value) => value + 1)}
                    className="flex h-10 w-10 items-center justify-center rounded-r-lg text-slate-500 hover:bg-slate-50"
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                {minimumQuantity !== null &&
                !beyondMaxDistance &&
                quantity < minimumQuantity ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setQuantity(minimumQuantity)}
                  >
                    Set to minimum ({minimumQuantity})
                  </Button>
                ) : null}
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <Truck className="h-5 w-5 text-brand-600" />
              Delivery schedule
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Available windows are managed by the station. Full windows are
              disabled.
            </p>

            {dateOptions.length === 0 ? (
              <div className="mt-4">
                <Alert tone="warning">
                  No delivery dates are currently available. Please contact the
                  station.
                </Alert>
              </div>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Delivery date" htmlFor="delivery-date" required>
                  <Select
                    id="delivery-date"
                    value={deliveryDate}
                    onChange={(event) => {
                      setDeliveryDate(event.target.value);
                      setScheduleId("");
                    }}
                  >
                    {dateOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>

                <Field
                  label="Delivery window"
                  htmlFor="delivery-window"
                  required
                >
                  <Select
                    id="delivery-window"
                    value={scheduleId}
                    onChange={(event) =>
                      setScheduleId(
                        event.target.value ? Number(event.target.value) : "",
                      )
                    }
                    disabled={scheduleOptions.length === 0}
                  >
                    {scheduleOptions.length === 0 ? (
                      <option value="">No windows available</option>
                    ) : (
                      scheduleOptions.map((option) => (
                        <option
                          key={option.schedule.id}
                          value={option.schedule.id}
                          disabled={option.full}
                        >
                          {formatTimeRange(
                            option.schedule.start_time,
                            option.schedule.end_time,
                          )}
                          {option.full
                            ? " — Full"
                            : ` — ${option.slotsLeft} slot(s) left`}
                        </option>
                      ))
                    )}
                  </Select>
                </Field>
              </div>
            )}

            {deliveryDate ? (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                Selected: {formatDeliveryDate(deliveryDate)}
                {selectedScheduleOption
                  ? `, ${formatTimeRange(
                      selectedScheduleOption.schedule.start_time,
                      selectedScheduleOption.schedule.end_time,
                    )}`
                  : ""}
              </p>
            ) : null}

            <div className="mt-4">
              <Field
                label="Delivery instructions"
                htmlFor="delivery-instructions"
                hint="Optional gate code, landmark, or other delivery notes."
              >
                <Textarea
                  id="delivery-instructions"
                  value={instructions}
                  onChange={(event) => setInstructions(event.target.value)}
                  placeholder="Example: Blue gate beside the sari-sari store, call upon arrival."
                />
              </Field>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-base font-semibold text-slate-900">
              Payment method
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Choose how you want to settle this order.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setPaymentMethod("cod")}
                className={`rounded-xl border p-4 text-left transition ${
                  paymentMethod === "cod"
                    ? "border-brand-500 bg-brand-50 ring-2 ring-brand-100"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">
                    Cash on Delivery
                  </p>
                  {paymentMethod === "cod" ? (
                    <CheckCircle2 className="h-4 w-4 text-brand-600" />
                  ) : null}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Pay the driver in cash when your water arrives. The payment
                  stays pending until collected.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod("stripe")}
                className={`rounded-xl border p-4 text-left transition ${
                  paymentMethod === "stripe"
                    ? "border-brand-500 bg-brand-50 ring-2 ring-brand-100"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">
                    Pay online
                  </p>
                  {paymentMethod === "stripe" ? (
                    <CheckCircle2 className="h-4 w-4 text-brand-600" />
                  ) : null}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Pay with your card before delivery. You will enter your card
                  details on the next screen.
                </p>
              </button>
            </div>
          </Card>
        </div>

        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="overflow-hidden">
            <div className="border-b border-slate-100 bg-slate-50/80 px-5 py-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <ShoppingCart className="h-4 w-4 text-brand-600" />
                Order summary
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                Final prices are confirmed by the server.
              </p>
            </div>

            <div className="space-y-3 px-5 py-4 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Product</span>
                <span className="text-right font-medium text-slate-900">
                  19L Purified Water
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Quantity</span>
                <span className="font-medium text-slate-900">
                  {quantity} container(s)
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Container type</span>
                <span className="text-right font-medium text-slate-900">
                  {containerType === "new" ? "New container" : "Exchange"}
                </span>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <div className="flex justify-between gap-3 text-slate-500">
                  <span>Water subtotal</span>
                  <span>{formatPeso(totals?.waterSubtotal ?? 0)}</span>
                </div>
                <div className="mt-1.5 flex justify-between gap-3 text-slate-500">
                  <span>Container subtotal</span>
                  <span>{formatPeso(totals?.containerSubtotal ?? 0)}</span>
                </div>
                <div className="mt-1.5 flex justify-between gap-3 text-slate-500">
                  <span>Delivery fee</span>
                  <span>{formatPeso(totals?.deliveryFee ?? 0)}</span>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <div className="flex justify-between gap-3 text-slate-500">
                  <span>Road distance</span>
                  <span>{distance !== null ? `${distance} km` : "—"}</span>
                </div>
                <div className="mt-1.5 flex justify-between gap-3 text-slate-500">
                  <span>Minimum required</span>
                  <span>
                    {minimumQuantity !== null
                      ? `${minimumQuantity} containers`
                      : "—"}
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <div className="flex justify-between gap-3 text-slate-500">
                  <span>Delivery date</span>
                  <span className="text-right">
                    {deliveryDate ? formatDeliveryDate(deliveryDate) : "—"}
                  </span>
                </div>
                <div className="mt-1.5 flex justify-between gap-3 text-slate-500">
                  <span>Window</span>
                  <span className="text-right">
                    {selectedScheduleOption
                      ? formatTimeRange(
                          selectedScheduleOption.schedule.start_time,
                          selectedScheduleOption.schedule.end_time,
                        )
                      : "—"}
                  </span>
                </div>
                <div className="mt-1.5 flex justify-between gap-3 text-slate-500">
                  <span>Address</span>
                  <span className="max-w-[190px] text-right text-xs">
                    {address.trim() || "—"}
                  </span>
                </div>
                <div className="mt-1.5 flex justify-between gap-3 text-slate-500">
                  <span>Payment</span>
                  <span className="text-right">
                    {paymentMethod === "cod" ? "Cash on Delivery" : "Stripe"}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                <span className="font-semibold text-slate-900">Total</span>
                <span className="text-xl font-bold text-slate-900">
                  {formatPeso(totals?.total ?? 0)}
                </span>
              </div>

              {belowMinimum && minimumQuantity !== null ? (
                <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Add {minimumQuantity - quantity} more container(s) to meet the
                  minimum.
                </p>
              ) : null}
            </div>

            <div className="border-t border-slate-100 px-5 py-4">
              <Button
                fullWidth
                size="lg"
                onClick={() => void handleSubmit()}
                loading={submitting}
                disabled={!canSubmit}
                icon={<ArrowRight className="h-4 w-4" />}
              >
                {paymentMethod === "cod"
                  ? "Place order — Cash on Delivery"
                  : "Continue to secure payment"}
              </Button>
              <p className="mt-2 text-center text-[11px] leading-relaxed text-slate-400">
                By placing this order you agree to provide accurate delivery
                details. The station re-validates your distance, minimum
                quantity, schedule and prices.
              </p>
            </div>
          </Card>

          <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs leading-relaxed text-slate-500">
            <p className="flex items-center gap-1.5 font-semibold text-slate-700">
              <MapPin className="h-3.5 w-3.5" />
              Delivering from
            </p>
            <p className="mt-1">{config.station.station_name}</p>
            <p>{config.station.address}</p>
            <Link
              to="/customer/orders"
              className="mt-2 inline-block font-semibold text-brand-700 hover:text-brand-800"
            >
              View my orders →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
