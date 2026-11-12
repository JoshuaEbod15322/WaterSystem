import { useCallback, useEffect, useMemo, useState } from "react";
import {
  // AlertTriangle,
  MapPinned,
  Pencil,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import type { DistancePricingRule, StationSettings } from "../../types";
import {
  deleteDistanceRule,
  getDistanceRules,
  getStationSettings,
  saveDistanceRule,
  setDistanceRuleActive,
  updateStationSettings,
} from "../../services/settings";
import { useToast } from "../../contexts/ToastContext";
import { getErrorMessage } from "../../utils/errors";
import { describeRange, formatKm } from "../../utils/calculations";
import {
  Alert,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Spinner,
} from "../../components/common/ui";
import { Button } from "../../components/common/Button";

interface RuleFormValues {
  minKm: string;
  maxKm: string;
  minQuantity: string;
  isActive: boolean;
}

const emptyForm: RuleFormValues = {
  minKm: "",
  maxKm: "",
  minQuantity: "",
  isActive: true,
};

export function AdminDistanceRulesPage() {
  const [rules, setRules] = useState<DistancePricingRule[]>([]);
  const [station, setStation] = useState<StationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [maxDistance, setMaxDistance] = useState("");
  const [savingDistance, setSavingDistance] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<DistancePricingRule | null>(
    null,
  );
  const [form, setForm] = useState<RuleFormValues>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [savingRule, setSavingRule] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DistancePricingRule | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [nextRules, nextStation] = await Promise.all([
        getDistanceRules(),
        getStationSettings(),
      ]);
      setRules(nextRules);
      setStation(nextStation);
      setMaxDistance(String(nextStation.max_delivery_distance_km));
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeRules = useMemo(
    () =>
      rules
        .filter((rule) => rule.is_active)
        .sort((a, b) => Number(a.min_km) - Number(b.min_km)),
    [rules],
  );

  const openCreate = () => {
    const lastRule = activeRules[activeRules.length - 1];
    setEditingRule(null);
    setForm({
      ...emptyForm,
      minKm: lastRule
        ? lastRule.max_km === null
          ? String(Number(lastRule.min_km) + 3)
          : String(lastRule.max_km)
        : "0",
    });
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (rule: DistancePricingRule) => {
    setEditingRule(rule);
    setForm({
      minKm: String(rule.min_km),
      maxKm: rule.max_km === null ? "" : String(rule.max_km),
      minQuantity: String(rule.min_quantity),
      isActive: rule.is_active,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSaveDistance = async () => {
    const value = Number(maxDistance);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Maximum delivery distance must be greater than zero.");
      return;
    }
    setSavingDistance(true);
    try {
      const updated = await updateStationSettings({
        station_name: station!.station_name,
        address: station!.address,
        latitude: station!.latitude,
        longitude: station!.longitude,
        contact_number: station!.contact_number,
        operating_hours: station!.operating_hours,
        max_delivery_distance_km: value,
      });
      setStation(updated);
      toast.success("Maximum delivery distance updated.");
    } catch (saveError) {
      toast.error(getErrorMessage(saveError));
    } finally {
      setSavingDistance(false);
    }
  };

  const handleSaveRule = async () => {
    setFormError(null);
    const minKm = Number(form.minKm);
    const maxKm = form.maxKm.trim() === "" ? null : Number(form.maxKm);
    const minQuantity = Number(form.minQuantity);

    if (!Number.isFinite(minKm) || minKm < 0) {
      setFormError("Starting distance must be zero or greater.");
      return;
    }
    if (maxKm !== null && (!Number.isFinite(maxKm) || maxKm <= minKm)) {
      setFormError(
        "Ending distance must be greater than the starting distance.",
      );
      return;
    }
    if (!Number.isInteger(minQuantity) || minQuantity < 1) {
      setFormError("Minimum quantity must be a whole number of at least 1.");
      return;
    }

    if (form.isActive) {
      const start = minKm;
      const end = maxKm ?? Number.POSITIVE_INFINITY;
      const overlap = rules.find((rule) => {
        if (!rule.is_active || rule.id === editingRule?.id) return false;
        const otherStart = Number(rule.min_km);
        const otherEnd =
          rule.max_km === null ? Number.POSITIVE_INFINITY : Number(rule.max_km);
        return start < otherEnd && otherStart < end;
      });
      if (overlap) {
        setFormError(
          `This range overlaps an active rule (${describeRange(
            Number(overlap.min_km),
            overlap.max_km === null ? null : Number(overlap.max_km),
          )}). Deactivate or edit the other rule first.`,
        );
        return;
      }
    }

    setSavingRule(true);
    try {
      await saveDistanceRule(
        {
          min_km: minKm,
          max_km: maxKm,
          min_quantity: minQuantity,
          is_active: form.isActive,
        },
        editingRule?.id,
      );
      toast.success(
        editingRule ? "Distance rule updated." : "Distance rule added.",
      );
      setModalOpen(false);
      await load(true);
    } catch (saveError) {
      setFormError(getErrorMessage(saveError));
    } finally {
      setSavingRule(false);
    }
  };

  const handleToggle = async (rule: DistancePricingRule) => {
    try {
      await setDistanceRuleActive(rule.id, !rule.is_active);
      toast.success(`Rule ${rule.is_active ? "deactivated" : "activated"}.`);
      await load(true);
    } catch (toggleError) {
      toast.error(getErrorMessage(toggleError));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDistanceRule(deleteTarget.id);
      toast.success("Distance rule deleted.");
      setDeleteTarget(null);
      await load(true);
    } catch (deleteError) {
      toast.error(getErrorMessage(deleteError));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Configuration"
        title="Distance-based minimum orders"
        description="Customers must order a minimum number of 19L containers based on the OSRM road distance from the station. Active ranges can never overlap."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
            Add rule
          </Button>
        }
      />

      {error ? (
        <Alert tone="error" title="Could not load distance rules">
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <Spinner label="Loading distance rules…" />
      ) : (
        <>
          <Card className="p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <MapPinned className="h-5 w-5 text-brand-600" />
                  <h2 className="text-base font-semibold text-slate-900">
                    Maximum delivery distance
                  </h2>
                </div>

                <div className="mt-3 max-w-xs">
                  <Field label="Maximum distance (km)" htmlFor="max-distance">
                    <Input
                      id="max-distance"
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={maxDistance}
                      onChange={(event) => setMaxDistance(event.target.value)}
                    />
                  </Field>
                </div>
              </div>
              <Button
                variant="secondary"
                onClick={() => void handleSaveDistance()}
                loading={savingDistance}
                icon={<Save className="h-4 w-4" />}
              >
                Save maximum
              </Button>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Distance rules
                </h2>
                <p className="text-xs text-slate-400">
                  Ranges use road distance in kilometers.
                </p>
              </div>
              <span className="text-xs text-slate-400">
                {activeRules.length} active rule(s)
              </span>
            </div>

            {rules.length === 0 ? (
              <EmptyState
                icon={MapPinned}
                title="No distance rules"
                description="Add at least one range so customers can place orders."
                action={
                  <Button
                    icon={<Plus className="h-4 w-4" />}
                    onClick={openCreate}
                  >
                    Add rule
                  </Button>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3">Distance range</th>
                      <th className="px-4 py-3">Minimum order</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[...rules]
                      .sort((a, b) => Number(a.min_km) - Number(b.min_km))
                      .map((rule) => (
                        <tr key={rule.id} className="hover:bg-slate-50/80">
                          <td className="px-4 py-3.5">
                            <p className="font-medium text-slate-900">
                              {describeRange(
                                Number(rule.min_km),
                                rule.max_km === null
                                  ? null
                                  : Number(rule.max_km),
                              )}
                            </p>
                            <p className="text-xs text-slate-400">
                              {formatKm(Number(rule.min_km))}
                              {rule.max_km === null
                                ? " and beyond"
                                : ` to ${formatKm(Number(rule.max_km))}`}
                            </p>
                          </td>
                          <td className="px-4 py-3.5 font-semibold text-slate-900">
                            {rule.min_quantity} containers
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
                                rule.is_active
                                  ? "bg-emerald-100 text-emerald-800 ring-emerald-200"
                                  : "bg-slate-100 text-slate-600 ring-slate-200"
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  rule.is_active
                                    ? "bg-emerald-500"
                                    : "bg-slate-400"
                                }`}
                              />
                              {rule.is_active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                icon={<Pencil className="h-3.5 w-3.5" />}
                                onClick={() => openEdit(rule)}
                              >
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => void handleToggle(rule)}
                              >
                                {rule.is_active ? "Deactivate" : "Activate"}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-rose-600 hover:bg-rose-50"
                                icon={<Trash2 className="h-3.5 w-3.5" />}
                                onClick={() => setDeleteTarget(rule)}
                                aria-label="Delete rule"
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              The database also rejects overlapping active ranges. If a range is
              edited so that it touches another range, save one rule as inactive
              first. Orders store the minimum quantity that applied when they
              were placed.
            </p>
          </div> */}
        </>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingRule ? "Edit distance rule" : "Add distance rule"}
        description="The ending distance is optional for an open-ended final range."
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setModalOpen(false)}
              disabled={savingRule}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleSaveRule()}
              loading={savingRule}
              icon={<Save className="h-4 w-4" />}
            >
              {editingRule ? "Save rule" : "Add rule"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError ? <Alert tone="error">{formError}</Alert> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="From (km)" htmlFor="min-km" required>
              <Input
                id="min-km"
                type="number"
                min="0"
                step="0.1"
                value={form.minKm}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    minKm: event.target.value,
                  }))
                }
              />
            </Field>
            <Field
              label="To (km)"
              htmlFor="max-km"
              hint="Leave blank for the final open-ended range."
            >
              <Input
                id="max-km"
                type="number"
                min="0"
                step="0.1"
                value={form.maxKm}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    maxKm: event.target.value,
                  }))
                }
              />
            </Field>
          </div>

          <Field
            label="Minimum containers"
            htmlFor="min-quantity"
            hint="Applies to both exchange and new-container orders."
            required
          >
            <Input
              id="min-quantity"
              type="number"
              min="1"
              step="1"
              value={form.minQuantity}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  minQuantity: event.target.value,
                }))
              }
            />
          </Field>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  isActive: event.target.checked,
                }))
              }
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            Rule is active
          </label>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete distance rule?"
        message={
          deleteTarget
            ? `The range ${describeRange(
                Number(deleteTarget.min_km),
                deleteTarget.max_km === null
                  ? null
                  : Number(deleteTarget.max_km),
              )} will be removed. Existing orders keep their recorded minimum.`
            : ""
        }
        confirmLabel="Delete rule"
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
