"use client";

import { useEffect, useState, useTransition } from "react";
import {
  addPeopleToList,
  bulkUpdateCategories,
  createGuestList,
  invitePeopleToEvent,
  updateEvent,
} from "@/app/actions/people";
import { CATEGORIES, type CategoryKey } from "@/lib/categories";
import { eventMetaLine, isPastEvent, type GuestListDTO } from "@/lib/list-kinds";

export function BulkBar({
  count,
  onClear,
  onEditTags,
  onAddToEvent,
  onAddToShortcut,
  onInvite,
  onArchive,
  onUnarchive,
  onDelete,
  onRemoveFromList,
  showRemoveFromList,
  removeFromListLabel,
  showUnarchive,
  showDelete,
}: {
  count: number;
  onClear: () => void;
  onEditTags: () => void;
  onAddToEvent: () => void;
  onAddToShortcut: () => void;
  onInvite: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
  onRemoveFromList: () => void;
  showRemoveFromList: boolean;
  removeFromListLabel: string;
  showUnarchive: boolean;
  showDelete: boolean;
}) {
  if (count < 1) return null;
  return (
    <div className="bulk-bar" role="region" aria-label="Bulk actions">
      <span className="bulk-count">{count} selected</span>
      <button type="button" className="primary-btn" onClick={onEditTags}>
        Edit tags
      </button>
      <button type="button" className="ghost-btn" onClick={onAddToEvent}>
        Add to event
      </button>
      <button type="button" className="ghost-btn" onClick={onAddToShortcut}>
        Add to shortcut
      </button>
      <button type="button" className="ghost-btn" onClick={onInvite}>
        Invite
      </button>
      {showRemoveFromList ? (
        <button type="button" className="ghost-btn" onClick={onRemoveFromList}>
          {removeFromListLabel}
        </button>
      ) : null}
      {showUnarchive ? (
        <button type="button" className="ghost-btn" onClick={onUnarchive}>
          Unarchive
        </button>
      ) : (
        <button type="button" className="ghost-btn" onClick={onArchive}>
          Archive
        </button>
      )}
      {showDelete ? (
        <button type="button" className="danger-btn" onClick={onDelete}>
          Delete
        </button>
      ) : null}
      <button type="button" className="ghost-btn" onClick={onClear}>
        Clear
      </button>
    </div>
  );
}

export function BulkTagsModal({
  open,
  personIds,
  onClose,
  onSaved,
}: {
  open: boolean;
  personIds: string[];
  onClose: () => void;
  onSaved: (add: CategoryKey[], remove: CategoryKey[]) => void;
}) {
  const [add, setAdd] = useState<Set<CategoryKey>>(new Set());
  const [remove, setRemove] = useState<Set<CategoryKey>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setAdd(new Set());
      setRemove(new Set());
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  function toggle(
    key: CategoryKey,
    bucket: "add" | "remove",
  ) {
    if (bucket === "add") {
      setAdd((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
      setRemove((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    } else {
      setRemove((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
      setAdd((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  }

  function save() {
    const addKeys = [...add];
    const removeKeys = [...remove];
    if (!addKeys.length && !removeKeys.length) {
      setError("Pick at least one tag to add or remove.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await bulkUpdateCategories(personIds, addKeys, removeKeys);
        onSaved(addKeys, removeKeys);
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not update tags.");
      }
    });
  }

  return (
    <div className="editor-backdrop" role="presentation" onClick={onClose}>
      <div
        className="choice-panel bulk-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Edit tags"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="editor-header">
          <div>
            <p className="eyebrow">Bulk edit</p>
            <h2>Tags for {personIds.length} people</h2>
          </div>
          <button type="button" className="ghost-btn" onClick={onClose}>
            Close
          </button>
        </header>
        <p className="choice-copy">
          Add tags to everyone selected, or remove tags from them. Unchecked
          tags are left unchanged.
        </p>
        <div className="bulk-tag-grid">
          <div>
            <p className="meta-label">Add</p>
            <div className="category-checks">
              {CATEGORIES.map((cat) => (
                <label key={`add-${cat.key}`} className="check">
                  <input
                    type="checkbox"
                    checked={add.has(cat.key)}
                    onChange={() => toggle(cat.key, "add")}
                  />
                  <span>{cat.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="meta-label">Remove</p>
            <div className="category-checks">
              {CATEGORIES.map((cat) => (
                <label key={`rm-${cat.key}`} className="check">
                  <input
                    type="checkbox"
                    checked={remove.has(cat.key)}
                    onChange={() => toggle(cat.key, "remove")}
                  />
                  <span>{cat.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="editor-actions-right" style={{ marginTop: "1rem" }}>
          <button
            type="button"
            className="primary-btn"
            onClick={save}
            disabled={pending}
          >
            {pending ? "Saving…" : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function BulkEventModal({
  open,
  personIds,
  events,
  preferredEventId,
  mode = "add",
  onClose,
  onSaved,
}: {
  open: boolean;
  personIds: string[];
  events: GuestListDTO[];
  preferredEventId?: string | null;
  mode?: "add" | "invite" | "shortcut";
  onClose: () => void;
  onSaved: (event: GuestListDTO, added: number) => void;
}) {
  const [eventId, setEventId] = useState(
    preferredEventId && events.some((e) => e.id === preferredEventId)
      ? preferredEventId
      : (events[0]?.id ?? ""),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      const preferred =
        preferredEventId && events.some((e) => e.id === preferredEventId)
          ? preferredEventId
          : (events[0]?.id ?? "");
      setEventId(preferred);
      setError(null);
    }
  }, [open, events, preferredEventId]);

  if (!open) return null;

  const countLabel =
    personIds.length === 1 ? "this person" : `${personIds.length} people`;
  const heading =
    mode === "invite"
      ? `Invite ${countLabel}`
      : mode === "shortcut"
        ? `Add ${personIds.length} to shortcut`
        : `Add ${personIds.length} to event`;
  const eyebrow =
    mode === "invite"
      ? "Upcoming game"
      : mode === "shortcut"
        ? "Shortcuts"
        : "Bulk add";
  const confirmLabel =
    mode === "invite"
      ? "Invite to event"
      : mode === "shortcut"
        ? "Add to shortcut"
        : "Add to event";
  const listLabel = mode === "shortcut" ? "Shortcut" : "Event";
  const emptyCopy =
    mode === "shortcut"
      ? "No shortcuts yet. Create one from the Shortcuts menu, then come back."
      : "No events yet. Create one with + New event, then come back.";

  function save() {
    if (!eventId) {
      setError(
        mode === "shortcut"
          ? "Create a shortcut first, then try again."
          : "Create an event first, then try again.",
      );
      return;
    }
    const event = events.find((e) => e.id === eventId);
    if (!event) {
      setError(mode === "shortcut" ? "Pick a shortcut." : "Pick an event.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const result =
          mode === "invite"
            ? await invitePeopleToEvent(personIds, eventId)
            : await addPeopleToList(personIds, eventId);
        onSaved(event, result.added);
        onClose();
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : mode === "shortcut"
              ? "Could not add to shortcut."
              : "Could not add to event.",
        );
      }
    });
  }

  return (
    <div className="editor-backdrop" role="presentation" onClick={onClose}>
      <div
        className="choice-panel"
        role="dialog"
        aria-modal="true"
        aria-label={heading}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="editor-header">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2>{heading}</h2>
          </div>
          <button type="button" className="ghost-btn" onClick={onClose}>
            Close
          </button>
        </header>
        <p className="choice-copy">
          {mode === "invite"
            ? "Which event should they be invited to? They’ll be added to that event’s list."
            : mode === "shortcut"
              ? "Pick a shortcut list to add the selected people to."
              : "Pick an event list to add the selected people to."}
        </p>
        {events.length ? (
          <label className="bulk-event-label">
            {listLabel}
            <select
              className="filter"
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
            >
              {events.map((e) => {
                if (mode === "shortcut") {
                  return (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  );
                }
                const meta = eventMetaLine(e);
                const past = isPastEvent(e);
                return (
                  <option key={e.id} value={e.id}>
                    {past ? "[Past] " : ""}
                    {meta ? `${e.name} — ${meta}` : e.name}
                  </option>
                );
              })}
            </select>
          </label>
        ) : (
          <p className="choice-copy">{emptyCopy}</p>
        )}
        {error ? <p className="form-error">{error}</p> : null}
        <div className="choice-actions" style={{ marginTop: "1rem" }}>
          <button
            type="button"
            className="primary-btn"
            onClick={save}
            disabled={pending || !events.length}
          >
            {pending ? "Saving…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function EventFormModal({
  open,
  event,
  onClose,
  onSaved,
}: {
  open: boolean;
  event?: GuestListDTO | null;
  onClose: () => void;
  onSaved: (list: GuestListDTO) => void;
}) {
  const isEdit = Boolean(event);
  const [name, setName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [venue, setVenue] = useState("");
  const [city, setCity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setName(event?.name ?? "");
      setEventDate(event?.eventDate ?? "");
      setVenue(event?.venue ?? "");
      setCity(event?.city ?? "");
      setError(null);
    }
  }, [open, event]);

  if (!open) return null;

  function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter an event name.");
      return;
    }
    if (!eventDate) {
      setError("Pick an event date.");
      return;
    }
    if (!venue.trim()) {
      setError("Enter the venue title.");
      return;
    }
    if (!city.trim()) {
      setError("Enter the city.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        if (isEdit && event) {
          const updated = await updateEvent(event.id, {
            name: trimmed,
            eventDate,
            venue: venue.trim(),
            city: city.trim(),
          });
          onSaved(updated);
        } else {
          const created = await createGuestList(trimmed, "event", {
            eventDate,
            venue: venue.trim(),
            city: city.trim(),
          });
          onSaved(created);
        }
        onClose();
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : isEdit
              ? "Could not update event."
              : "Could not create event.",
        );
      }
    });
  }

  return (
    <div className="editor-backdrop" role="presentation" onClick={onClose}>
      <div
        className="choice-panel"
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? "Edit event" : "New event"}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="editor-header">
          <div>
            <p className="eyebrow">Events</p>
            <h2>{isEdit ? "Edit event" : "New event"}</h2>
          </div>
          <button type="button" className="ghost-btn" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="editor-grid" style={{ marginTop: "0.75rem" }}>
          <label className="full">
            Event name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Four Seasons Sept 2026"
              autoFocus
            />
          </label>
          <label>
            Date
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
          </label>
          <label>
            Venue
            <input
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              placeholder="Venue title"
            />
          </label>
          <label className="full">
            City
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Los Angeles"
            />
          </label>
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="choice-actions" style={{ marginTop: "1rem" }}>
          <button
            type="button"
            className="ghost-btn"
            onClick={onClose}
            disabled={pending}
          >
            Cancel
          </button>
          <button
            type="button"
            className="primary-btn"
            onClick={save}
            disabled={pending}
          >
            {pending
              ? isEdit
                ? "Saving…"
                : "Creating…"
              : isEdit
                ? "Save changes"
                : "Create event"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** @deprecated Prefer EventFormModal — kept as a create-only alias. */
export function NewEventModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (list: GuestListDTO) => void;
}) {
  return (
    <EventFormModal
      open={open}
      onClose={onClose}
      onSaved={onCreated}
    />
  );
}
