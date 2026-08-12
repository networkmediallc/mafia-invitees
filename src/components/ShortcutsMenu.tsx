"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import {
  createGuestList,
  deleteGuestList,
} from "@/app/actions/people";
import type { GuestListDTO } from "@/lib/list-kinds";

export function ShortcutsMenu({
  shortcuts,
  activeId,
  onSelect,
  onCreated,
  onDeleted,
}: {
  shortcuts: GuestListDTO[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreated: (list: GuestListDTO) => void;
  onDeleted: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);

  const active = shortcuts.find((s) => s.id === activeId);
  const label = active ? active.name : "Shortcuts";

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
        setError(null);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function create() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a name.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const created = await createGuestList(trimmed, "shortcut");
        onCreated(created);
        setName("");
        setCreating(false);
        setOpen(false);
        onSelect(created.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not create shortcut.");
      }
    });
  }

  function remove(list: GuestListDTO, e: ReactMouseEvent) {
    e.stopPropagation();
    if (list.kind === "archived" || list.slug === "archived") return;
    if (!confirm(`Delete shortcut “${list.name}”? People stay in the address book.`)) {
      return;
    }
    startTransition(async () => {
      try {
        await deleteGuestList(list.id);
        onDeleted(list.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not delete.");
      }
    });
  }

  return (
    <div className="shortcuts-menu" ref={rootRef}>
      <button
        type="button"
        className={`shortcut-menu-trigger ${active ? "active" : ""}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span>{label}</span>
        <span aria-hidden>▾</span>
      </button>
      {open ? (
        <div className="shortcut-menu-panel" role="menu">
          {shortcuts.map((s) => (
            <div key={s.id} className="shortcut-menu-row">
              <button
                type="button"
                role="menuitem"
                className={
                  activeId === s.id
                    ? "shortcut-menu-item active"
                    : "shortcut-menu-item"
                }
                onClick={() => {
                  onSelect(s.id);
                  setOpen(false);
                  setCreating(false);
                }}
              >
                {s.name}
              </button>
              {s.kind !== "archived" && s.slug !== "archived" ? (
                <button
                  type="button"
                  className="shortcut-delete"
                  aria-label={`Delete ${s.name}`}
                  disabled={pending}
                  onClick={(e) => remove(s, e)}
                >
                  ×
                </button>
              ) : null}
            </div>
          ))}
          <div className="shortcut-menu-divider" />
          {creating ? (
            <div className="shortcut-create">
              <input
                className="search"
                placeholder="Shortcut name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") create();
                  if (e.key === "Escape") {
                    setCreating(false);
                    setError(null);
                  }
                }}
                autoFocus
              />
              <div className="shortcut-create-actions">
                <button
                  type="button"
                  className="primary-btn"
                  onClick={create}
                  disabled={pending}
                >
                  {pending ? "…" : "Create"}
                </button>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => {
                    setCreating(false);
                    setError(null);
                  }}
                >
                  Cancel
                </button>
              </div>
              {error ? <p className="form-error">{error}</p> : null}
            </div>
          ) : (
            <button
              type="button"
              className="shortcut-menu-item shortcut-menu-new"
              onClick={() => {
                setCreating(true);
                setError(null);
              }}
            >
              + New shortcut
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
