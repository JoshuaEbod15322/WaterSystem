import { useCallback, useEffect, useState } from "react";
import { Clock, Phone, RefreshCw, Save, Store } from "lucide-react";
import type { StationSettings } from "../../types";
import {
  getStationSettings,
  updateStationSettings,
} from "../../services/settings";
import { useToast } from "../../contexts/ToastContext";
import { getErrorMessage } from "../../utils/errors";
import {
  Alert,
  Card,
  Field,
  Input,
  PageHeader,
  Spinner,
} from "../../components/common/ui";
import { Button } from "../../components/common/Button";
import { MapPicker } from "../../components/common/MapPicker";

export function AdminSettingsPage() {
  const [station, setStation] = useState<StationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const [stationName, setStationName] = useState("");
  const [address, setAddress] = useState("");
  const [contact, setContact] = useState("");
  const [hours, setHours] = useState("");
  const [latitude, setLatitude] = useState(0);
  const [longitude, setLongitude] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await getStationSettings();
      setStation(next);
      setStationName(next.station_name);
      setAddress(next.address);
      setContact(next.contact_number);
      setHours(next.operating_hours);
      setLatitude(next.latitude);
      setLongitude(next.longitude);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    if (stationName.trim().length < 2) {
      toast.error("Station name is required.");
      return;
    }
    if (!address.trim()) {
      toast.error("Station address is required.");
      return;
    }
    if (
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90 ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      toast.error("Enter valid latitude and longitude values.");
      return;
    }

    setSaving(true);
    try {
      const updated = await updateStationSettings({
        station_name: stationName.trim(),
        address: address.trim(),
        contact_number: contact.trim(),
        operating_hours: hours.trim(),
        latitude,
        longitude,
        max_delivery_distance_km: station!.max_delivery_distance_km,
      });
      setStation(updated);
      toast.success("Station settings saved.");
    } catch (saveError) {
      toast.error(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Configuration"
        title="Station settings"
        description="Set the station's real name, address, contact details and coordinates. The coordinates are used as the starting point for every delivery route."
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
        <Alert tone="error" title="Could not load station settings">
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <Spinner label="Loading station settings…" />
      ) : (
        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="p-5 xl:col-span-2">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <Store className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Station information
                </h2>
                <p className="text-xs text-slate-400">
                  Displayed to customers on the landing page and checkout.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <Field label="Station name" htmlFor="station-name" required>
                <Input
                  id="station-name"
                  value={stationName}
                  onChange={(event) => setStationName(event.target.value)}
                  placeholder="Station name"
                />
              </Field>

              <Field label="Full address" htmlFor="station-address" required>
                <Input
                  id="station-address"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="Barangay, City, Province"
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Contact number"
                  htmlFor="station-contact"
                  // hint="Shown to customers if provided."
                >
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="station-contact"
                      value={contact}
                      onChange={(event) => setContact(event.target.value)}
                      placeholder="09XX XXX XXXX"
                      className="pl-9"
                    />
                  </div>
                </Field>

                <Field
                  label="Operating hours"
                  htmlFor="station-hours"
                  // hint="Free-text, e.g. Mon-Sat: 7:00 AM - 6:00 PM."
                >
                  <div className="relative">
                    <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="station-hours"
                      value={hours}
                      onChange={(event) => setHours(event.target.value)}
                      placeholder="Mon-Sat: 7:00 AM - 6:00 PM"
                      className="pl-9"
                    />
                  </div>
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Latitude"
                  htmlFor="station-lat"
                  // hint="Between -90 and 90."
                  required
                >
                  <Input
                    id="station-lat"
                    type="number"
                    step="0.000001"
                    value={latitude}
                    onChange={(event) =>
                      setLatitude(Number(event.target.value))
                    }
                  />
                </Field>
                <Field
                  label="Longitude"
                  htmlFor="station-lng"
                  // hint="Between -180 and 180."
                  required
                >
                  <Input
                    id="station-lng"
                    type="number"
                    step="0.000001"
                    value={longitude}
                    onChange={(event) =>
                      setLongitude(Number(event.target.value))
                    }
                  />
                </Field>
              </div>

              <Button
                onClick={() => void handleSave()}
                loading={saving}
                icon={<Save className="h-4 w-4" />}
              >
                Save station settings
              </Button>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-sm font-semibold text-slate-900">
              Pin the station
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Your station location will be the starting point for every
              delivery route.
            </p>

            <div className="mt-4">
              <MapPicker
                value={{ lat: latitude, lng: longitude }}
                onChange={(point) => {
                  setLatitude(point.lat);
                  setLongitude(point.lng);
                }}
                heightClass="h-72"
                zoom={15}
              />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
