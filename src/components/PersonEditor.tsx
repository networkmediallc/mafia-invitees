"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  CATEGORIES,
  type CategoryKey,
} from "@/lib/categories";
import type { PersonDTO } from "@/lib/people";
import { attendanceLabel } from "@/lib/people";
import { createPerson, deletePerson, setPersonArchived, updatePerson } from "@/app/actions/people";

type Props = {
  person?: PersonDTO | null;
  /** null = create in address book only (no list membership) */
  listId: string | null;
  open: boolean;
  onClose: () => void;
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
} & Record<CategoryKey, boolean>;

function fromPerson(person?: PersonDTO | null): FormState {
  const cats = Object.fromEntries(
    CATEGORIES.map((c) => [c.key, person?.[c.key] ?? false]),
  ) as Record<CategoryKey, boolean>;

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
    ...cats,
  };
}

export function PersonEditor({ person, listId, open, onClose }: Props) {
  const [form, setForm] = useState<FormState>(() => fromPerson(person));
  const [error, setError] = useState<string | null>(null);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const isEdit = Boolean(person);

  useEffect(() => {
    if (open) {
      setForm(fromPerson(person));
      setError(null);
      setArchiveConfirmOpen(false);
    }
  }, [open, person]);

  const title = useMemo(
    () => (isEdit ? "Edit person" : "Add person"),
    [isEdit],
  );

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
        };
        if (isEdit && person) {
          await updatePerson(person.id, payload);
        } else {
          await createPerson(listId, payload);
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
            {CATEGORIES.map((cat) => (
              <label key={cat.key} className="check">
                <input
                  type="checkbox"
                  checked={form[cat.key]}
                  onChange={(e) => setField(cat.key, e.target.checked)}
                />
                <span>{cat.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {person?.groupTags ? (
          <div className="meta-block">
            <p className="meta-label">Address Book tags</p>
            <p className="meta-value">{person.groupTags}</p>
          </div>
        ) : null}

        {person?.attendances?.length ? (
          <div className="meta-block">
            <p className="meta-label">Attendance</p>
            <ul className="attendance-list">
              {person.attendances.map((a) => (
                <li key={a.eventId} className={`attendance-row status-${a.status}`}>
                  <span className="attendance-event">{a.eventName}</span>
                  <span className="attendance-status">
                    {attendanceLabel(a.status)}
                  </span>
                </li>
              ))}
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
                <button
                  type="button"
                  className="danger-btn"
                  onClick={remove}
                  disabled={pending}
                >
                  Delete
                </button>
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
