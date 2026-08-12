"use client";

import { useEffect, useRef, useState } from "react";
import { CATEGORIES, type CategoryKey } from "@/lib/categories";

type MatchMode = "any" | "all";

export function CategoryFilter({
  selected,
  matchMode,
  onChange,
  onMatchModeChange,
}: {
  selected: Set<CategoryKey>;
  matchMode: MatchMode;
  onChange: (next: Set<CategoryKey>) => void;
  onMatchModeChange: (mode: MatchMode) => void;
}) {
  const [open, setOpen] = useState(false);
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
        ? CATEGORIES.find((c) => selected.has(c.key))?.label ?? "1 category"
        : `${count} categories`;

  function toggle(key: CategoryKey) {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange(next);
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
            {CATEGORIES.map((cat) => (
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
        </div>
      ) : null}
    </div>
  );
}
