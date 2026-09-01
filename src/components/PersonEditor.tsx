"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import type { CategoryDTO } from "@/lib/categories";
import type { AttendanceEventOption, PersonDTO } from "@/lib/people";
import { ATTENDANCE_STATUSES } from "@/lib/people";
import {
  createCategory,
  createPerson,
  deletePerson,
  setPersonArchived,
  setPersonAttendances,
  updatePerson,
} from "@/app/actions/people";

type Props = {
  person?: PersonDTO | null;
  /** null = create in address book only (no list membership) */
  listId: string | null;
  open: boolean;
  onClose: () => void;
  /** Only true on Address Book — hide delete on events / shortcuts */
  allowDelete?: boolean;
  /** Past + historical events available for attendance editing */
  attendanceEvents?: AttendanceEventOption[];
  categories: CategoryDTO[];
  onCategoryCreated?: (category: CategoryDTO) => void;
};

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  title: string;
  plusOnes: string;
  notes: string;
  whoIsThis: string;
  previousPlayer: boolean;
  categoryKeys: string[];
};

function fromPerson(person?: PersonDTO | null): FormState {
  return {
    firstName: person?.firstName ?? "",
    lastName: person?.lastName ?? "",
    email: person?.email ?? "",
    phone: person?.phone ?? "",
    title: person?.title ?? "",
    plusOnes: person?.plusOnes ?? "",
    notes: person?.notes ?? "",
    whoIsThis: person?.whoIsThis ?? "",
    previousPlayer: person?.previousPlayer ?? false,
    categoryKeys: person?.categoryKeys ? [...person.categoryKeys] : [],
  };
}

function attendanceKey(event: AttendanceEventOption) {
  return event.id ?? `list:${event.guestListId ?? event.slug}`;
}

export function PersonEditor({
  person,
  listId,
  open,
  onClose,
  allowDelete = false,
  attendanceEvents = [],
  categories,
  onCategoryCreated,
}: Props) {
  const [form, setForm] = useState<FormState>(() => fromPerson(person));
  const [newCategoryLabel, setNewCategoryLabel] = useState("");
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const isEdit = Boolean(person);

  useEffect(() => {
    if (open) {
      setForm(fromPerson(person));
      setNewCategoryLabel("");
      const next: Record<string, string> = {};
      for (const event of attendanceEvents) {
        const key = attendanceKey(event);
        const existing = person?.attendances?.find(
          (a) =>
            (event.id && a.eventId === event.id) ||
            a.eventName === event.name,
        );
        next[key] = existing?.status ?? "";
      }
      // Keep orphan attendance rows (event removed from options) visible
      for (const a of person?.attendances ?? []) {
        if (
          !attendanceEvents.some(
            (e) => e.id === a.eventId || e.name === a.eventName,
          )
        ) {
          next[`orphan:${a.eventId}`] = a.status;
        }
      }
      setAttendance(next);
      setError(null);
      setArchiveConfirmOpen(false);
    }
  }, [open, person, attendanceEvents]);

  const title = useMemo(
    () => (isEdit ? "Edit person" : "Add person"),
    [isEdit],
  );

  const orphanEvents = useMemo(() => {
    if (!person?.attendances?.length) return [];
    return person.attendances.filter(
      (a) =>
        !attendanceEvents.some(
          (e) => e.id === a.eventId || e.name === a.eventName,
        ),
    );
  }, [person, attendanceEvents]);

  if (!open) return null;

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function save() {
    if (!form.firstName.trim()) {
      setError("First name is required.");
      return;
    }
    startTransition(async () => {
      try {
        const payload = {
          ...form,
          email: form.email || null,
          phone: form.phone || null,
          title: form.title || null,
          plusOnes: form.plusOnes || null,
          notes: form.notes || null,
          whoIsThis: form.whoIsThis || null,
          categoryKeys: form.categoryKeys,
        };
        let personId = person?.id;
        if (isEdit && person) {
          await updatePerson(person.id, payload);
        } else {
          const created = await createPerson(listId, payload);
          personId = created.id;
        }

        if (personId && (isEdit || attendanceEvents.length)) {
          const rows = [
            ...attendanceEvents.map((event) => ({
              eventId: event.id,
              guestListId: event.guestListId ?? null,
              slug: event.slug,
              name: event.name,
              status: attendance[attendanceKey(event)] ?? "",
            })),
            ...orphanEvents.map((a) => ({
              eventId: a.eventId,
              status: attendance[`orphan:${a.eventId}`] ?? a.status,
            })),
          ];
          if (rows.length) {
            await setPersonAttendances(personId, rows);
          }
        }
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not save.");
      }
    });
  }

  function remove() {
    if (!person) return;
    const name = `${person.firstName} ${person.lastName}`.trim();
    if (
      !confirm(
        `Are you sure you want to permanently delete ${name}? This cannot be undone.\n\nOK to delete, Cancel to keep them.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      await deletePerson(person.id);
      onClose();
    });
  }

  function toggleArchive() {
    if (!person) return;
    if (person.archived) {
      applyArchive(false);
      return;
    }
    setArchiveConfirmOpen(true);
  }

  function applyArchive(archived: boolean) {
    if (!person) return;
    setArchiveConfirmOpen(false);
    startTransition(async () => {
      try {
        await setPersonArchived(person.id, archived);
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not update archive.");
      }
    });
  }

  const showAttendance =
    isEdit && (attendanceEvents.length > 0 || orphanEvents.length > 0);

  function toggleCategory(key: string, checked: boolean) {
    setForm((prev) => {
      const set = new Set(prev.categoryKeys);
      if (checked) set.add(key);
      else set.delete(key);
      return { ...prev, categoryKeys: [...set] };
    });
  }

  function addNewCategory() {
    const trimmed = newCategoryLabel.trim();
    if (!trimmed) {
      setError("Enter a category name.");
      return;
    }
    startTransition(async () => {
      try {
        const created = await createCategory(trimmed);
        onCategoryCreated?.(created);
        setForm((prev) => ({
          ...prev,
          categoryKeys: prev.categoryKeys.includes(created.key)
            ? prev.categoryKeys
            : [...prev.categoryKeys, created.key],
        }));
        setNewCategoryLabel("");
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not create category.");
      }
    });
  }

  return (
    <div className="editor-backdrop" role="presentation" onClick={onClose}>
      <div
        className="editor-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="editor-header">
          <div>
            <p className="eyebrow">{isEdit ? "Update" : "New"}</p>
            <h2>{title}</h2>
          </div>
          <button type="button" className="ghost-btn" onClick={onClose}>
            Close
          </button>
        </header>

        <div className="editor-grid">
          <label>
            First name
            <input
              value={form.firstName}
              onChange={(e) => setField("firstName", e.target.value)}
              autoFocus
            />
          </label>
          <label>
            Last name
            <input
              value={form.lastName}
              onChange={(e) => setField("lastName", e.target.value)}
            />
          </label>
          <label>
            Email
            <input
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
            />
          </label>
          <label>
            Phone
            <input
              value={form.phone}
              onChange={(e) => setField("phone", e.target.value)}
            />
          </label>
          <label>
            Plus ones allowed
            <input
              value={form.plusOnes}
              onChange={(e) => setField("plusOnes", e.target.value)}
              placeholder="1, 2, or notes"
            />
          </label>
          <label>
            Title / role
            <input
              value={form.title}
              onChange={(e) => setField("title", e.target.value)}
            />
          </label>
          <label className="full">
            Notes
            <textarea
              value={form.notes}
              onChange={(e) => setField("notes", e.target.value)}
              rows={3}
            />
          </label>
          <label className="full">
            Who is this?
            <textarea
              value={form.whoIsThis}
              onChange={(e) => setField("whoIsThis", e.target.value)}
              rows={2}
            />
          </label>
        </div>

        <fieldset className="category-box">
          <legend>Categories</legend>
          <div className="category-checks">
            {categories.map((cat) => (
              <label key={cat.key} className="check">
                <input
                  type="checkbox"
                  checked={form.categoryKeys.includes(cat.key)}
                  onChange={(e) => toggleCategory(cat.key, e.target.checked)}
                />
                <span>{cat.label}</span>
              </label>
            ))}
          </div>
          <div className="filter-add-category">
            <input
              className="filter"
              placeholder="New category name"
              value={newCategoryLabel}
              onChange={(e) => setNewCategoryLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addNewCategory();
                }
              }}
              disabled={pending}
            />
            <button
              type="button"
              className="ghost-btn"
              onClick={addNewCategory}
              disabled={pending}
            >
              Add category
            </button>
          </div>
        </fieldset>

        {person?.groupTags ? (
          <div className="meta-block">
            <p className="meta-label">Address Book tags</p>
            <p className="meta-value">{person.groupTags}</p>
          </div>
        ) : null}

        {showAttendance ? (
          <div className="meta-block">
            <p className="meta-label">Attendance</p>
            <p className="meta-hint">
              Update records for past games. Clear a status to remove the
              record.
            </p>
            <ul className="attendance-list">
              {attendanceEvents.map((event) => {
                const key = attendanceKey(event);
                const status = attendance[key] ?? "";
                return (
                  <li
                    key={key}
                    className={`attendance-row editable status-${status || "empty"}`}
                  >
                    <span className="attendance-event">{event.name}</span>
                    <select
                      className="attendance-select"
                      value={status}
                      onChange={(e) =>
                        setAttendance((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
                      disabled={pending}
                      aria-label={`Attendance for ${event.name}`}
                    >
                      <option value="">—</option>
                      {ATTENDANCE_STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </li>
                );
              })}
              {orphanEvents.map((a) => {
                const key = `orphan:${a.eventId}`;
                const status = attendance[key] ?? a.status;
                return (
                  <li
                    key={key}
                    className={`attendance-row editable status-${status || "empty"}`}
                  >
                    <span className="attendance-event">{a.eventName}</span>
                    <select
                      className="attendance-select"
                      value={status}
                      onChange={(e) =>
                        setAttendance((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
                      disabled={pending}
                      aria-label={`Attendance for ${a.eventName}`}
                    >
                      <option value="">—</option>
                      {ATTENDANCE_STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <div className="editor-actions">
          {error ? <p className="form-error">{error}</p> : <span />}
          <div className="editor-actions-right">
            {isEdit ? (
              <>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={toggleArchive}
                  disabled={pending}
                >
                  {person?.archived ? "Unarchive" : "Archive"}
                </button>
                {allowDelete ? (
                  <button
                    type="button"
                    className="danger-btn"
                    onClick={remove}
                    disabled={pending}
                  >
                    Delete
                  </button>
                ) : null}
              </>
            ) : null}
            <button
              type="button"
              className="primary-btn"
              onClick={save}
              disabled={pending}
            >
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={archiveConfirmOpen}
        message="Are you sure? Archiving this contact will hide them from your other lists"
        confirmLabel="Yes"
        cancelLabel="Cancel"
        onConfirm={() => applyArchive(true)}
        onCancel={() => setArchiveConfirmOpen(false)}
      />
    </div>
  );
}
