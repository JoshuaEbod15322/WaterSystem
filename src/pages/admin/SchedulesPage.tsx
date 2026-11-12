import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Pencil,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import type { DeliverySchedule } from "../../types";
import {
  deleteDeliverySchedule,
  getDeliverySchedules,
  saveDeliverySchedule,
} from "../../services/settings";
import { useToast } from "../../contexts/ToastContext";
import { getErrorMessage } from "../../utils/errors";
import { formatTimeRange, weekdayName } from "../../utils/dates";
import { WEEKDAY_NAMES } from "../../utils/constants";
import {
  Alert,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
} from "../../components/common/ui";
import { Button } from "../../components/common/Button";

interface ScheduleFormValues {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  maxOrders: string;
  isActive: boolean;
}

const emptyForm: ScheduleFormValues = {
  dayOfWeek: "1",
  startTime: "08:00",
  endTime: "10:00",
  maxOrders: "10",
  isActive: true,
};

export function AdminSchedulesPage() {
  const [schedules, setSchedules] = useState<DeliverySchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DeliverySchedule | null>(null);
  const [form, setForm] = useState<ScheduleFormValues>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeliverySchedule | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const toast = useToast();

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const next = await getDeliverySchedules();
      setSchedules(next);
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    return WEEKDAY_NAMES.map((name, day) => ({
      day,
      name,
      schedules: schedules
        .filter((schedule) => schedule.day_of_week === day)
        .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    })).filter((group) => group.day !== 0);
  }, [schedules]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (schedule: DeliverySchedule) => {
    setEditing(schedule);
    setForm({
      dayOfWeek: String(schedule.day_of_week),
      startTime: schedule.start_time.slice(0, 5),
      endTime: schedule.end_time.slice(0, 5),
      maxOrders: String(schedule.max_orders),
      isActive: schedule.is_active,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    setFormError(null);
    const maxOrders = Number(form.maxOrders);
    if (!form.startTime || !form.endTime) {
      setFormError("Start and end times are required.");
      return;
    }
    if (form.endTime <= form.startTime) {
      setFormError("End time must be after the start time.");
      return;
    }
    if (!Number.isInteger(maxOrders) || maxOrders < 1) {
      setFormError("Maximum orders must be a whole number of at least 1.");
      return;
    }

    setSaving(true);
    try {
      await saveDeliverySchedule(
        {
          day_of_week: Number(form.dayOfWeek),
          start_time: form.startTime,
          end_time: form.endTime,
          max_orders: maxOrders,
          is_active: form.isActive,
        },
        editing?.id,
      );
      toast.success(editing ? "Schedule updated." : "Schedule added.");
      setModalOpen(false);
      await load(true);
    } catch (saveError) {
      setFormError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (schedule: DeliverySchedule) => {
    try {
      await saveDeliverySchedule(
        {
          day_of_week: schedule.day_of_week,
          start_time: schedule.start_time,
          end_time: schedule.end_time,
          max_orders: schedule.max_orders,
          is_active: !schedule.is_active,
        },
        schedule.id,
      );
      toast.success(`Schedule ${schedule.is_active ? "disabled" : "enabled"}.`);
      await load(true);
    } catch (toggleError) {
      toast.error(getErrorMessage(toggleError));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDeliverySchedule(deleteTarget.id);
      toast.success("Schedule deleted.");
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
        title="Delivery schedules"
        description="Define the weekly delivery windows customers can choose from. Each window has its own maximum number of orders per day."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
            Add schedule
          </Button>
        }
      />

      {error ? (
        <Alert tone="error" title="Could not load schedules">
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <Spinner label="Loading schedules…" />
      ) : schedules.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No delivery schedules"
          description="Add delivery windows so customers can choose a schedule."
          action={
            <Button icon={<Plus className="h-4 w-4" />} onClick={openCreate}>
              Add schedule
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {grouped.map((group) => (
            <Card key={group.day} className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-900">
                  {group.name}
                </h2>
                <span className="text-xs text-slate-400">
                  {
                    group.schedules.filter((schedule) => schedule.is_active)
                      .length
                  }{" "}
                  active
                </span>
              </div>

              {group.schedules.length === 0 ? (
                <p className="px-4 py-5 text-xs text-slate-400">
                  No windows for {group.name.toLowerCase()}.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {group.schedules.map((schedule) => (
                    <li
                      key={schedule.id}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          {formatTimeRange(
                            schedule.start_time,
                            schedule.end_time,
                          )}
                        </p>
                        <p className="text-xs text-slate-400">
                          Max {schedule.max_orders} orders ·{" "}
                          {schedule.is_active ? "Enabled" : "Disabled"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <span
                          className={`mr-1 h-2 w-2 rounded-full ${
                            schedule.is_active
                              ? "bg-emerald-500"
                              : "bg-slate-300"
                          }`}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => void handleToggle(schedule)}
                        >
                          {schedule.is_active ? "Disable" : "Enable"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<Pencil className="h-3.5 w-3.5" />}
                          onClick={() => openEdit(schedule)}
                          aria-label="Edit schedule"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-rose-600 hover:bg-rose-50"
                          icon={<Trash2 className="h-3.5 w-3.5" />}
                          onClick={() => setDeleteTarget(schedule)}
                          aria-label="Delete schedule"
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit delivery schedule" : "Add delivery schedule"}
        description="Schedules repeat every week."
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setModalOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleSave()}
              loading={saving}
              icon={<Save className="h-4 w-4" />}
            >
              {editing ? "Save schedule" : "Add schedule"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError ? <Alert tone="error">{formError}</Alert> : null}

          <Field label="Day of week" htmlFor="schedule-day" required>
            <Select
              id="schedule-day"
              value={form.dayOfWeek}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  dayOfWeek: event.target.value,
                }))
              }
            >
              {WEEKDAY_NAMES.map((name, index) => (
                <option key={name} value={index}>
                  {name}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Start time" htmlFor="schedule-start" required>
              <Input
                id="schedule-start"
                type="time"
                value={form.startTime}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    startTime: event.target.value,
                  }))
                }
              />
            </Field>
            <Field label="End time" htmlFor="schedule-end" required>
              <Input
                id="schedule-end"
                type="time"
                value={form.endTime}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    endTime: event.target.value,
                  }))
                }
              />
            </Field>
          </div>

          <Field
            label="Maximum orders per window"
            htmlFor="schedule-max"
            hint="Applies to the same date and window."
            required
          >
            <Input
              id="schedule-max"
              type="number"
              min="1"
              step="1"
              value={form.maxOrders}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  maxOrders: event.target.value,
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
            Schedule is enabled
          </label>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete delivery schedule?"
        message={
          deleteTarget
            ? `${weekdayName(deleteTarget.day_of_week)}, ${formatTimeRange(
                deleteTarget.start_time,
                deleteTarget.end_time,
              )} will be removed. Existing orders keep their recorded delivery window.`
            : ""
        }
        confirmLabel="Delete schedule"
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
