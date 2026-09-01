"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createCategory } from "@/app/actions/people";
import type { CategoryDTO } from "@/lib/categories";

type MatchMode = "any" | "all";

export function CategoryFilter({
  categories,
  selected,
  matchMode,
  onChange,
  onMatchModeChange,
  onCategoryCreated,
}: {
  categories: CategoryDTO[];
  selected: Set<string>;
  matchMode: MatchMode;
  onChange: (next: Set<string>) => void;
  onMatchModeChange: (mode: MatchMode) => void;
  onCategoryCreated: (category: CategoryDTO) => void;
}) {
  const [open, setOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const count = selected.size;
  const label =
    count === 0
      ? "All categories"
      : count === 1
        ? categories.find((c) => selected.has(c.key))?.label ?? "1 category"
        : `${count} categories`;

  function toggle(key: string) {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(next);
  }

  function addCategory() {
    const trimmed = newLabel.trim();
    if (!trimmed) {
      setError("Enter a category name.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const created = await createCategory(trimmed);
        onCategoryCreated(created);
        setNewLabel("");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not create category.");
      }
    });
  }

  return (
    <div className="filter-dropdown" ref={rootRef}>
      <button
        type="button"
        className={`filter-trigger ${count ? "active" : ""}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
      >
        <span>{label}</span>
        <span className="filter-caret" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <div className="filter-panel" role="listbox" aria-label="Categories">
          <div className="filter-panel-head">
            <div className="match-toggle" role="group" aria-label="Match mode">
              <button
                type="button"
                className={matchMode === "any" ? "active" : ""}
                onClick={() => onMatchModeChange("any")}
              >
                Any
              </button>
              <button
                type="button"
                className={matchMode === "all" ? "active" : ""}
                onClick={() => onMatchModeChange("all")}
              >
                All
              </button>
            </div>
            <button
              type="button"
              className="ghost-btn filter-clear"
              onClick={() => onChange(new Set())}
              disabled={!count}
            >
              Clear
            </button>
          </div>
          <p className="filter-hint">
            {matchMode === "any"
              ? "Show people with at least one selected tag."
              : "Show people who have every selected tag."}
          </p>
          <div className="filter-checks">
            {categories.map((cat) => (
              <label key={cat.key} className="check">
                <input
                  type="checkbox"
                  checked={selected.has(cat.key)}
                  onChange={() => toggle(cat.key)}
                />
                <span>{cat.label}</span>
              </label>
            ))}
          </div>
          <div className="filter-add-category">
            <input
              className="filter"
              placeholder="New category name"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCategory();
                }
              }}
              disabled={pending}
            />
            <button
              type="button"
              className="ghost-btn"
              onClick={addCategory}
              disabled={pending}
            >
              {pending ? "Adding…" : "Add"}
            </button>
          </div>
          {error ? <p className="form-error">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
