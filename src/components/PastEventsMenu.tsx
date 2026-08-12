"use client";

import { useEffect, useRef, useState } from "react";
import {
  eventMetaLine,
  type GuestListDTO,
} from "@/lib/list-kinds";

export function PastEventsMenu({
  events,
  activeId,
  onSelect,
}: {
  events: GuestListDTO[];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = events.find((e) => e.id === activeId);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!events.length) return null;

  return (
    <div className="past-events-menu" ref={rootRef}>
      <button
        type="button"
        className={`past-events-trigger ${active ? "active" : ""}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span>{active ? active.name : "Past events"}</span>
        <span aria-hidden>▾</span>
      </button>
      {open ? (
        <div className="past-events-panel" role="menu">
          <p className="past-events-hint">Past events (Pacific time)</p>
          {events.map((e) => {
            const meta = eventMetaLine(e);
            return (
              <button
                key={e.id}
                type="button"
                role="menuitem"
                className={
                  e.id === activeId
                    ? "past-events-item active"
                    : "past-events-item"
                }
                onClick={() => {
                  onSelect(e.id);
                  setOpen(false);
                }}
              >
                <span className="past-events-name">{e.name}</span>
                {meta ? <span className="past-events-meta">{meta}</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
