import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  Crosshair,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Save,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type { LatLng } from "../../types";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { usePublicConfig } from "../../hooks/usePublicConfig";
import { updateOwnProfile } from "../../services/auth";
import {
  geocodeAddress,
  getBrowserLocation,
  reverseGeocode,
} from "../../services/maps";
import { getErrorMessage } from "../../utils/errors";
import { formatDateTime } from "../../utils/dates";
import {
  Alert,
  Card,
  Field,
  Input,
  PageHeader,
  Textarea,
} from "../../components/common/ui";
import { Button } from "../../components/common/Button";
import { MapPicker } from "../../components/common/MapPicker";

export function CustomerProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const toast = useToast();
  const { config } = usePublicConfig();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [point, setPoint] = useState<LatLng | null>(null);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const forwardRequest = useRef(0);
  const forwardAbort = useRef<AbortController | null>(null);
  const reverseRequest = useRef(0);
  const reverseAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name);
    setPhone(profile.phone ?? "");
    setAddress(profile.address ?? "");
  }, [profile]);

  const profileId = profile?.id ?? null;
  const profileAddress = profile?.address ?? null;
  const profileLatitude = profile?.latitude ?? null;
  const profileLongitude = profile?.longitude ?? null;

  useEffect(() => {
    if (!profileId) return;
    setLookupError(null);
    setLocating(false);
    const requestId = ++forwardRequest.current;

    if (profileLatitude !== null && profileLongitude !== null) {
      setPoint({ lat: profileLatitude, lng: profileLongitude });
      return;
    }

    const savedAddress = (profileAddress ?? "").trim();
    if (!savedAddress) {
      setPoint(null);
      return;
    }

    const controller = new AbortController();
    forwardAbort.current = controller;
    setLocating(true);

    geocodeAddress(savedAddress, controller.signal)
      .then((result) => {
        if (requestId !== forwardRequest.current) return;
        if (result) {
          setPoint(result);
        } else {
          setLookupError(
            "We could not locate your saved address on the map. Tap the map to set your default pin.",
          );
        }
      })
      .catch((lookupFailure) => {
        if ((lookupFailure as Error).name === "AbortError") return;
        if (requestId === forwardRequest.current) {
          setLookupError(getErrorMessage(lookupFailure));
        }
      })
      .finally(() => {
        if (requestId === forwardRequest.current) setLocating(false);
      });

    return () => controller.abort();
  }, [profileId, profileAddress, profileLatitude, profileLongitude]);

  useEffect(() => () => reverseAbort.current?.abort(), []);

  const handlePick = (nextPoint: LatLng) => {
    setPoint(nextPoint);
    setLookupError(null);

    forwardAbort.current?.abort();
    forwardRequest.current += 1;
    setLocating(false);

    reverseAbort.current?.abort();
    const controller = new AbortController();
    reverseAbort.current = controller;
    const requestId = ++reverseRequest.current;

    setGeocoding(true);
    reverseGeocode(nextPoint, controller.signal)
      .then((result) => {
        if (requestId === reverseRequest.current && result) {
          setAddress(result);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (requestId === reverseRequest.current) setGeocoding(false);
      });
  };

  const handleUseLocation = async () => {
    try {
      const location = await getBrowserLocation();
      handlePick(location);
      toast.success("Current location pinned. Drag the pin to adjust.");
    } catch (locationError) {
      toast.error(getErrorMessage(locationError));
    }
  };

  const handleLocateAddress = async () => {
    const typed = address.trim();
    if (!typed) {
      toast.error("Enter a delivery address first.");
      return;
    }

    forwardAbort.current?.abort();
    const controller = new AbortController();
    forwardAbort.current = controller;
    const requestId = ++forwardRequest.current;

    setLocating(true);
    setLookupError(null);
    try {
      const result = await geocodeAddress(typed, controller.signal);
      if (requestId !== forwardRequest.current) return;
      if (result) {
        setPoint(result);
        toast.success("Address pinned on the map. Drag the pin to adjust.");
      } else {
        setLookupError(
          "We could not find that address on the map. Tap the map to pin it manually.",
        );
      }
    } catch (lookupFailure) {
      if ((lookupFailure as Error).name === "AbortError") return;
      if (requestId === forwardRequest.current) {
        setLookupError(getErrorMessage(lookupFailure));
      }
    } finally {
      if (requestId === forwardRequest.current) setLocating(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    if (fullName.trim().length < 2) {
      toast.error("Enter your full name.");
      return;
    }
    if (!/^[0-9+()\-\s]{7,20}$/.test(phone.trim())) {
      toast.error("Enter a valid mobile number.");
      return;
    }

    setSaving(true);
    setError(null);
    let resolvedPoint = point;
    try {
      if (!resolvedPoint && address.trim()) {
        setLocating(true);
        const geocoded = await geocodeAddress(address.trim());
        if (geocoded) {
          resolvedPoint = geocoded;
          setPoint(geocoded);
        } else {
          setLookupError(
            "We could not locate this address on the map. Tap the map to set your default pin.",
          );
        }
      }

      await updateOwnProfile(profile.id, {
        full_name: fullName.trim(),
        phone: phone.trim(),
        address: address.trim() || null,
        latitude: resolvedPoint?.lat ?? null,
        longitude: resolvedPoint?.lng ?? null,
      });
      await refreshProfile();
      toast.success("Profile updated.");
    } catch (saveError) {
      const message = getErrorMessage(saveError);
      setError(message);
      toast.error(message);
    } finally {
      setLocating(false);
      setSaving(false);
    }
  };

  if (!profile) return null;

  const station = config
    ? { lat: config.station.latitude, lng: config.station.longitude }
    : undefined;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Account"
        title="My profile"
        description="Keep your contact details up to date so drivers can reach you."
      />

      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-700">
              {profile.full_name.charAt(0).toUpperCase() || "C"}
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Personal information
              </h2>
              <p className="text-xs text-slate-400">
                Your email is managed by Supabase Authentication.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <Field label="Full name" htmlFor="profile-name" required>
              <Input
                id="profile-name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                autoComplete="name"
              />
            </Field>

            <Field label="Email address" htmlFor="profile-email">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="profile-email"
                  value={profile.email}
                  disabled
                  className="pl-9"
                />
              </div>
            </Field>

            <Field
              label="Mobile number"
              htmlFor="profile-phone"
              hint="Drivers may call this number during delivery."
              required
            >
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="profile-phone"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="09XX XXX XXXX"
                  autoComplete="tel"
                  className="pl-9"
                />
              </div>
            </Field>

            <Field
              label="Default delivery address"
              htmlFor="profile-address"
              hint="Used as your default location. Auto-filled when you move the pin."
            >
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Textarea
                  id="profile-address"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="House number, street, barangay, city"
                  className="min-h-20 pl-9"
                />
              </div>
            </Field>

            <Button
              onClick={() => void handleSave()}
              loading={saving}
              disabled={locating || geocoding}
              icon={<Save className="h-4 w-4" />}
            >
              Save changes
            </Button>
            {locating || geocoding ? (
              <p className="text-xs text-slate-500">
                Wait for the map lookup to finish before saving.
              </p>
            ) : null}
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Account overview
            </h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center gap-2 text-slate-500">
                <UserRound className="h-4 w-4 text-slate-400" />
                Customer account
              </div>
              <div className="flex items-center gap-2 text-slate-500">
                <Mail className="h-4 w-4 text-slate-400" />
                {profile.email}
              </div>
              <div className="flex items-center gap-2 text-slate-500">
                <CalendarDays className="h-4 w-4 text-slate-400" />
                Member since {formatDateTime(profile.created_at)}
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <MapPin className="h-4 w-4 text-brand-600" />
              Default delivery pin
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Tap the map or drag the pin. Your default address fills in
              automatically.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                icon={<Crosshair className="h-3.5 w-3.5" />}
                onClick={() => void handleUseLocation()}
              >
                Use my location
              </Button>
              <Button
                size="sm"
                variant="outline"
                icon={<Search className="h-3.5 w-3.5" />}
                onClick={() => void handleLocateAddress()}
                disabled={!address.trim() || locating}
              >
                Locate address
              </Button>
            </div>

            <div className="mt-3">
              <MapPicker
                value={point}
                onChange={handlePick}
                station={station}
                heightClass="h-56"
                zoom={14}
              />
            </div>

            <div className="mt-3 min-h-5 text-xs">
              {locating ? (
                <span className="flex items-center gap-1.5 text-brand-700">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Locating the address on the map…
                </span>
              ) : geocoding ? (
                <span className="flex items-center gap-1.5 text-brand-700">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Updating the address from your pin…
                </span>
              ) : lookupError ? (
                <span className="text-amber-700">{lookupError}</span>
              ) : point ? (
                <span className="text-slate-500">
                  Pin set at {point.lat.toFixed(5)}, {point.lng.toFixed(5)}.
                  Drag the pin to adjust.
                </span>
              ) : (
                <span className="text-slate-500">
                  Tap the map to set your default delivery pin.
                </span>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
