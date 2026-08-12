export type ListKind = "shortcut" | "event" | "archived";

export type GuestListDTO = {
  id: string;
  name: string;
  slug: string;
  kind: ListKind;
  sortOrder: number;
  eventDate: string | null;
  venue: string | null;
  city: string | null;
};

export function toGuestListDTO(list: {
  id: string;
  name: string;
  slug: string;
  kind: string;
  sortOrder: number;
  eventDate?: string | null;
  venue?: string | null;
  city?: string | null;
}): GuestListDTO {
  const kind: ListKind =
    list.kind === "archived"
      ? "archived"
      : list.kind === "event"
        ? "event"
        : list.kind === "shortcut"
          ? "shortcut"
          : // legacy "ranked" → treat known slugs as shortcuts, else events
            list.slug === "los-angeles" || list.slug === "vegas"
            ? "shortcut"
            : "event";

  return {
    id: list.id,
    name: list.name,
    slug: list.slug,
    kind,
    sortOrder: list.sortOrder,
    eventDate: list.eventDate ?? null,
    venue: list.venue ?? null,
    city: list.city ?? null,
  };
}

export function slugifyListName(name: string) {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "list";
}

/** Ranked invite lists (shortcuts + events) support drag order. */
export function isRankedKind(kind: ListKind) {
  return kind === "shortcut" || kind === "event";
}

export function formatEventDate(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function eventMetaLine(list: Pick<GuestListDTO, "eventDate" | "venue" | "city">) {
  return [formatEventDate(list.eventDate), list.venue, list.city]
    .filter(Boolean)
    .join(" · ");
}

/** Calendar date YYYY-MM-DD in America/Los_Angeles (Pacific). */
export function pacificTodayISO(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** True when the event’s date is before today in Pacific time. */
export function isPastEvent(
  list: Pick<GuestListDTO, "kind" | "eventDate">,
  today = pacificTodayISO(),
) {
  if (list.kind !== "event" || !list.eventDate) return false;
  return list.eventDate < today;
}

export function compareEventsByDate(
  a: Pick<GuestListDTO, "eventDate" | "name" | "sortOrder">,
  b: Pick<GuestListDTO, "eventDate" | "name" | "sortOrder">,
  direction: "asc" | "desc" = "asc",
) {
  const da = a.eventDate || "";
  const db = b.eventDate || "";
  if (da !== db) {
    return direction === "asc" ? da.localeCompare(db) : db.localeCompare(da);
  }
  return (
    a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)
  );
}
