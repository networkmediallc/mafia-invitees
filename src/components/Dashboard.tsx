"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useMemo, useState, useTransition } from "react";
import { PersonEditor } from "@/components/PersonEditor";
import {
  BulkBar,
  BulkEventModal,
  BulkTagsModal,
  EventFormModal,
} from "@/components/BulkActions";
import { CategoryFilter } from "@/components/CategoryFilter";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PastEventsMenu } from "@/components/PastEventsMenu";
import { ShortcutsMenu } from "@/components/ShortcutsMenu";
import {
  addPersonToList,
  bulkDeletePeople,
  bulkSetArchived,
  deleteGuestList,
  markUpcomingInvited,
  removePeopleFromList,
  resetUpcomingInvite,
  saveListOrder,
} from "@/app/actions/people";
import { CATEGORIES, type CategoryKey } from "@/lib/categories";
import {
  compareEventsByDate,
  eventMetaLine,
  isPastEvent,
  isRankedKind,
  type GuestListDTO,
} from "@/lib/list-kinds";
import {
  displayName,
  membershipForList,
  personCategories,
  type AttendanceEventOption,
  type PersonDTO,
} from "@/lib/people";

const ADDRESS_BOOK_ID = "__address-book__";

function defaultTabId(lists: GuestListDTO[]) {
  return (
    lists.find((l) => l.slug === "los-angeles")?.id ??
    lists.find((l) => l.kind === "shortcut")?.id ??
    ADDRESS_BOOK_ID
  );
}

type Props = {
  people: PersonDTO[];
  lists: GuestListDTO[];
  attendanceEvents: AttendanceEventOption[];
  userName: string;
};

function PersonRow({
  person,
  rank,
  showRank,
  sortable,
  selected,
  onToggleSelect,
  onEdit,
  onInvite,
  onUninvite,
  inviting,
  dimmed,
}: {
  person: PersonDTO;
  rank: number;
  showRank: boolean;
  sortable: boolean;
  selected: boolean;
  dimmed?: boolean;
  onToggleSelect: (id: string) => void;
  onEdit: (p: PersonDTO) => void;
  onInvite: (p: PersonDTO) => void;
  onUninvite: (p: PersonDTO) => void;
  inviting: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: person.id, disabled: !sortable });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const cats = personCategories(person);
  const inviteStatus = person.upcomingInviteStatus || "none";
  const inviteLabel =
    inviteStatus === "invited"
      ? `Invited ${person.upcomingInvitedOn || ""}`.trim()
      : inviteStatus === "selected"
        ? "Pending"
        : "Invite to Upcoming Game";
  const inviteClass =
    inviteStatus === "invited"
      ? "invite-btn invited"
      : inviteStatus === "selected"
        ? "invite-btn selected"
        : "invite-btn";

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`person-row ${isDragging ? "dragging" : ""} ${showRank ? "" : "no-rank"} ${selected ? "selected" : ""} ${dimmed ? "is-archived" : ""}`}
    >
      <label className="row-select">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(person.id)}
          aria-label={`Select ${displayName(person)}`}
        />
      </label>
      {sortable ? (
        <button
          type="button"
          className="drag-handle"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          ⋮⋮
        </button>
      ) : (
        <span className="drag-spacer" aria-hidden />
      )}
      {showRank ? <div className="rank">{rank}</div> : null}
      <button type="button" className="person-main" onClick={() => onEdit(person)}>
        <div className="person-name-row">
          <h3>{displayName(person)}</h3>
          {person.plusOnes ? (
            <span className="chip plus">+{person.plusOnes}</span>
          ) : null}
          {person.previousPlayer ? (
            <span className="chip attended">Attended before</span>
          ) : null}
          {person.archived && person.archivedAt ? (
            <span className="chip archived">Archived {person.archivedAt}</span>
          ) : null}
        </div>
        <p className="person-meta">
          {[person.email, person.phone, person.title].filter(Boolean).join(" · ") ||
            "No contact info"}
        </p>
        {person.notes || person.whoIsThis ? (
          <p className="person-notes">
            {person.notes}
            {person.notes && person.whoIsThis ? " · " : ""}
            {person.whoIsThis}
          </p>
        ) : null}
      </button>
      <div className="person-tags">
        {cats.length ? (
          <div className="tag-row">
            {cats.map((cat) => (
              <span key={cat.key} className={`tag tag-${cat.key}`}>
                {cat.label}
              </span>
            ))}
          </div>
        ) : (
          <p className="tag-empty">No categories</p>
        )}
      </div>
      <div className="invite-actions">
        <button
          type="button"
          className={inviteClass}
          disabled={inviting || inviteStatus === "invited"}
          onClick={(e) => {
            e.stopPropagation();
            onInvite(person);
          }}
        >
          {inviteLabel}
        </button>
        {inviteStatus === "selected" || inviteStatus === "invited" ? (
          <button
            type="button"
            className="uninvite-btn"
            disabled={inviting}
            onClick={(e) => {
              e.stopPropagation();
              onUninvite(person);
            }}
          >
            Reset / Uninvite
          </button>
        ) : null}
      </div>
    </article>
  );
}

function AddPersonMenu({
  open,
  onClose,
  onNewContact,
  onFromAddressBook,
}: {
  open: boolean;
  onClose: () => void;
  onNewContact: () => void;
  onFromAddressBook: () => void;
}) {
  if (!open) return null;
  return (
    <div className="editor-backdrop" role="presentation" onClick={onClose}>
      <div
        className="choice-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Add person"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="editor-header">
          <div>
            <p className="eyebrow">Add</p>
            <h2>Add person</h2>
          </div>
          <button type="button" className="ghost-btn" onClick={onClose}>
            Close
          </button>
        </header>
        <p className="choice-copy">
          Create a brand-new contact, or pull someone in from the Mafia Address
          Book.
        </p>
        <div className="choice-actions">
          <button type="button" className="primary-btn" onClick={onNewContact}>
            New contact
          </button>
          <button type="button" className="ghost-btn choice-secondary" onClick={onFromAddressBook}>
            From address book
          </button>
        </div>
      </div>
    </div>
  );
}

function AddressBookPicker({
  open,
  people,
  listId,
  onClose,
  onAdded,
}: {
  open: boolean;
  people: PersonDTO[];
  listId: string;
  onClose: () => void;
  onAdded: (person: PersonDTO) => void;
}) {
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<Set<CategoryKey>>(new Set());
  const [categoryMatch, setCategoryMatch] = useState<"any" | "all">("any");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setQuery("");
      setCategories(new Set());
      setCategoryMatch("any");
      setError(null);
      setPendingId(null);
    }
  }, [open]);

  const candidates = useMemo(() => {
    let list = people.filter((p) => !membershipForList(p, listId));
    if (categories.size) {
      const keys = [...categories];
      list = list.filter((p) =>
        categoryMatch === "all"
          ? keys.every((key) => p[key])
          : keys.some((key) => p[key]),
      );
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((p) => {
        const hay = [
          p.firstName,
          p.lastName,
          p.email,
          p.phone,
          ...personCategories(p).map((c) => c.label),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    return [...list].sort((a, b) =>
      displayName(a).localeCompare(displayName(b)),
    );
  }, [people, listId, categories, categoryMatch, query]);

  if (!open) return null;

  function pick(person: PersonDTO) {
    setError(null);
    setPendingId(person.id);
    startTransition(async () => {
      try {
        await addPersonToList(person.id, listId);
        onAdded(person);
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not add person.");
        setPendingId(null);
      }
    });
  }

  return (
    <div className="editor-backdrop" role="presentation" onClick={onClose}>
      <div
        className="picker-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Select from address book"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="editor-header">
          <div>
            <p className="eyebrow">Address book</p>
            <h2>Select a person</h2>
          </div>
          <button type="button" className="ghost-btn" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="picker-toolbar">
          <input
            className="search"
            placeholder="Search address book…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <CategoryFilter
            selected={categories}
            matchMode={categoryMatch}
            onChange={setCategories}
            onMatchModeChange={setCategoryMatch}
          />
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="picker-list">
          {candidates.map((p) => (
            <button
              key={p.id}
              type="button"
              className="picker-row"
              disabled={pendingId === p.id}
              onClick={() => pick(p)}
            >
              <span className="picker-name">{displayName(p)}</span>
              <span className="picker-meta">
                {[p.email, p.phone].filter(Boolean).join(" · ") || "No contact"}
              </span>
            </button>
          ))}
          {!candidates.length ? (
            <p className="empty">No matching people left to add.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function Dashboard({
  people,
  lists: initialLists,
  attendanceEvents,
  userName,
}: Props) {
  const [lists, setLists] = useState(initialLists);
  const [tabId, setTabId] = useState(() => defaultTabId(initialLists));
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<Set<CategoryKey>>(new Set());
  const [categoryMatch, setCategoryMatch] = useState<"any" | "all">("any");
  const [items, setItems] = useState(people);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<PersonDTO | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [newListOpen, setNewListOpen] = useState(false);
  const [editEventOpen, setEditEventOpen] = useState(false);
  const [deleteEventConfirmOpen, setDeleteEventConfirmOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTagsOpen, setBulkTagsOpen] = useState(false);
  const [bulkEventOpen, setBulkEventOpen] = useState(false);
  const [bulkShortcutOpen, setBulkShortcutOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invitePersonIds, setInvitePersonIds] = useState<string[]>([]);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [uninvitePerson, setUninvitePerson] = useState<PersonDTO | null>(null);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  const [shortcutSort, setShortcutSort] = useState<"rank" | "name">("rank");
  const [, startTransition] = useTransition();

  useEffect(() => {
    setItems(people);
  }, [people]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [tabId]);

  useEffect(() => {
    setShortcutSort("rank");
  }, [tabId]);

  useEffect(() => {
    setLists(initialLists);
    if (
      tabId !== ADDRESS_BOOK_ID &&
      !initialLists.some((l) => l.id === tabId) &&
      initialLists[0]
    ) {
      setTabId(defaultTabId(initialLists));
    }
  }, [initialLists, tabId]);

  const isAddressBook = tabId === ADDRESS_BOOK_ID;
  const activeList = isAddressBook
    ? null
    : (lists.find((l) => l.id === tabId) ?? lists[0] ?? null);
  const isArchivedTab = activeList?.kind === "archived";
  const isEventTab = activeList?.kind === "event";
  const isShortcutTab = activeList?.kind === "shortcut";
  const isRankedTab = activeList ? isRankedKind(activeList.kind) : false;
  const sortListByName = isRankedTab && shortcutSort === "name";
  const sortByRank = isRankedTab && !sortListByName;

  const shortcutLists = useMemo(
    () =>
      lists.filter((l) => l.kind === "shortcut" || l.kind === "archived"),
    [lists],
  );
  const addableShortcuts = useMemo(
    () => lists.filter((l) => l.kind === "shortcut"),
    [lists],
  );
  const eventLists = useMemo(
    () => lists.filter((l) => l.kind === "event"),
    [lists],
  );
  const upcomingEvents = useMemo(
    () =>
      eventLists
        .filter((e) => !isPastEvent(e))
        .sort((a, b) => compareEventsByDate(a, b, "asc")),
    [eventLists],
  );
  const pastEvents = useMemo(
    () =>
      eventLists
        .filter((e) => isPastEvent(e))
        .sort((a, b) => compareEventsByDate(a, b, "desc")),
    [eventLists],
  );
  const isPastEventTab = Boolean(
    isEventTab && activeList && isPastEvent(activeList),
  );

  function upsertEventInLists(dto: GuestListDTO) {
    setLists((prev) => {
      const shortcuts = prev.filter(
        (l) => l.kind === "shortcut" || l.kind === "archived",
      );
      const events = prev
        .filter((l) => l.kind === "event" && l.id !== dto.id)
        .concat(dto);
      return [...shortcuts, ...events];
    });
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const filtered = useMemo(() => {
    let list: PersonDTO[];

    if (isAddressBook) {
      list = [...items].sort((a, b) =>
        displayName(a).localeCompare(displayName(b)),
      );
    } else if (!activeList) {
      list = [];
    } else {
      list = items.filter((p) => {
        if (isArchivedTab) return p.archived;
        if (p.archived) return false;
        return Boolean(membershipForList(p, activeList.id));
      });

      list = [...list].sort((a, b) => {
        if (sortByRank) {
          const ra = membershipForList(a, activeList.id)?.rank ?? 9999;
          const rb = membershipForList(b, activeList.id)?.rank ?? 9999;
          return ra - rb;
        }
        return displayName(a).localeCompare(displayName(b));
      });
    }

    if (categories.size) {
      const keys = [...categories];
      list = list.filter((p) =>
        categoryMatch === "all"
          ? keys.every((key) => p[key])
          : keys.some((key) => p[key]),
      );
    }

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((p) => {
        const hay = [
          p.firstName,
          p.lastName,
          p.email,
          p.phone,
          p.title,
          p.notes,
          p.whoIsThis,
          ...personCategories(p).map((c) => c.label),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }

    return list;
  }, [
    items,
    activeList,
    isAddressBook,
    isArchivedTab,
    sortByRank,
    categories,
    categoryMatch,
    query,
  ]);

  const canReorder = Boolean(
    sortByRank && !query && categories.size === 0 && activeList,
  );
  const showRank = isRankedTab;
  const selectedCount = selectedIds.size;
  const allVisibleSelected =
    filtered.length > 0 && filtered.every((p) => selectedIds.has(p.id));

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllVisible() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const p of filtered) next.delete(p.id);
      } else {
        for (const p of filtered) next.add(p.id);
      }
      return next;
    });
  }

  function onDragEnd(event: DragEndEvent) {
    if (!canReorder || !activeList) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const visibleIds = filtered.map((p) => p.id);
    const oldIndex = visibleIds.indexOf(String(active.id));
    const newIndex = visibleIds.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;

    const reorderedVisible = arrayMove(filtered, oldIndex, newIndex);
    const rankById = new Map(
      reorderedVisible.map((p, i) => [p.id, i + 1] as const),
    );
    const orderedIds = reorderedVisible.map((p) => p.id);
    const listId = activeList.id;

    setItems((prev) =>
      prev.map((p) => {
        const nextRank = rankById.get(p.id);
        if (nextRank == null) return p;
        const has = p.memberships.some((m) => m.listId === listId);
        return {
          ...p,
          memberships: has
            ? p.memberships.map((m) =>
                m.listId === listId ? { ...m, rank: nextRank } : m,
              )
            : [...p.memberships, { listId, rank: nextRank }],
        };
      }),
    );

    setMessage("Saving order…");
    startTransition(async () => {
      try {
        await saveListOrder(listId, orderedIds);
        setMessage("Order saved.");
        window.setTimeout(() => setMessage(null), 1500);
      } catch {
        setMessage("Could not save order. Try again.");
      }
    });
  }

  function openCreate() {
    if (isAddressBook) {
      setEditing(null);
      setEditorOpen(true);
      return;
    }
    setAddMenuOpen(true);
  }

  function openEdit(p: PersonDTO) {
    setEditing(p);
    setEditorOpen(true);
  }

  function invitePerson(person: PersonDTO) {
    const status = person.upcomingInviteStatus || "none";
    if (status === "invited") return;

    if (status === "selected") {
      const today = new Date();
      const dateLabel = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
      setItems((prev) =>
        prev.map((p) =>
          p.id === person.id
            ? {
                ...p,
                upcomingInviteStatus: "invited",
                upcomingInvitedOn: dateLabel,
                sent: dateLabel,
              }
            : p,
        ),
      );
      setInvitingId(person.id);
      startTransition(async () => {
        try {
          const result = await markUpcomingInvited(person.id);
          setItems((prev) =>
            prev.map((p) =>
              p.id === person.id
                ? {
                    ...p,
                    upcomingInviteStatus: result.upcomingInviteStatus,
                    upcomingInvitedOn: result.upcomingInvitedOn,
                    sent: result.upcomingInvitedOn,
                  }
                : p,
            ),
          );
        } catch {
          setItems(people);
          setMessage("Could not mark as invited.");
        } finally {
          setInvitingId(null);
        }
      });
      return;
    }

    const ids =
      selectedIds.size > 0 && selectedIds.has(person.id)
        ? [...selectedIds]
        : [person.id];
    setInvitePersonIds(ids);
    setInviteOpen(true);
  }

  function requestUninvite(person: PersonDTO) {
    setUninvitePerson(person);
  }

  function confirmUninvite() {
    const person = uninvitePerson;
    if (!person) return;
    setUninvitePerson(null);
    const fallbackEventId =
      person.upcomingInviteEventId ||
      (isEventTab ? activeList?.id : null) ||
      null;
    setInvitingId(person.id);
    startTransition(async () => {
      try {
        const result = await resetUpcomingInvite(person.id, fallbackEventId);
        const removedId = result.removedFromEventId;
        setItems((prev) =>
          prev.map((p) => {
            if (p.id !== person.id) return p;
            return {
              ...p,
              upcomingInviteStatus: "none",
              upcomingInvitedOn: null,
              upcomingInviteEventId: null,
              sent:
                p.sent &&
                p.upcomingInvitedOn &&
                p.sent === p.upcomingInvitedOn
                  ? null
                  : p.sent,
              memberships: removedId
                ? p.memberships.filter((m) => m.listId !== removedId)
                : p.memberships,
            };
          }),
        );
        if (removedId) {
          setMessage("Removed from event and invite reset.");
          window.setTimeout(() => setMessage(null), 2000);
        }
      } catch {
        setItems(people);
        setMessage("Could not uninvite.");
      } finally {
        setInvitingId(null);
      }
    });
  }

  function applyAddedToEvent(
    event: GuestListDTO,
    ids: string[],
    added: number,
    asInvite = false,
  ) {
    setItems((prev) =>
      prev.map((p) => {
        if (!ids.includes(p.id)) return p;
        const memberships = p.memberships.some((m) => m.listId === event.id)
          ? p.memberships
          : [...p.memberships, { listId: event.id, rank: null }];
        return {
          ...p,
          archived: false,
          memberships,
          ...(asInvite
            ? {
                upcomingInviteStatus: "selected",
                upcomingInviteEventId: event.id,
                upcomingInvitedOn: null,
              }
            : {}),
        };
      }),
    );
    setMessage(
      asInvite
        ? added
          ? `Pending invite for ${added} on ${event.name}.`
          : `Marked pending on ${event.name}.`
        : added
          ? `Added ${added} to ${event.name}.`
          : `Everyone selected was already on ${event.name}.`,
    );
    setSelectedIds(new Set());
    window.setTimeout(() => setMessage(null), 2500);
  }

  function handlePickedFromBook(person: PersonDTO) {
    if (!activeList) return;
    setItems((prev) =>
      prev.map((p) => {
        if (p.id !== person.id) return p;
        if (p.memberships.some((m) => m.listId === activeList.id)) return p;
        const maxRank = Math.max(
          0,
          ...prev
            .flatMap((x) => x.memberships)
            .filter((m) => m.listId === activeList.id)
            .map((m) => m.rank ?? 0),
        );
        return {
          ...p,
          archived: activeList.kind === "archived" ? true : false,
          memberships: [
            ...p.memberships.filter((m) => m.listId !== activeList.id),
            {
              listId: activeList.id,
              rank: activeList.kind === "archived" ? null : maxRank + 1,
            },
          ],
        };
      }),
    );
    setMessage(`Added ${displayName(person)} to ${activeList.name}.`);
    window.setTimeout(() => setMessage(null), 2000);
  }

  function runBulkArchive(archived: boolean) {
    const ids = [...selectedIds];
    if (!ids.length) return;
    if (archived) {
      setArchiveConfirmOpen(true);
      return;
    }
    applyBulkArchive(false, ids);
  }

  function applyBulkArchive(archived: boolean, ids: string[]) {
    if (!ids.length) return;
    setArchiveConfirmOpen(false);
    const verb = archived ? "Archive" : "Unarchive";
    const archivedListId = lists.find((l) => l.kind === "archived")?.id;
    startTransition(async () => {
      try {
        await bulkSetArchived(ids, archived);
        const today = new Date();
        const dateLabel = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
        setItems((prev) =>
          prev.map((p) => {
            if (!ids.includes(p.id)) return p;
            let memberships = p.memberships;
            if (archivedListId) {
              if (archived) {
                if (!memberships.some((m) => m.listId === archivedListId)) {
                  memberships = [
                    ...memberships,
                    { listId: archivedListId, rank: null },
                  ];
                }
              } else {
                memberships = memberships.filter(
                  (m) => m.listId !== archivedListId,
                );
              }
            }
            return {
              ...p,
              archived,
              archivedAt: archived ? dateLabel : null,
              memberships,
            };
          }),
        );
        setSelectedIds(new Set());
        setMessage(`${verb}d ${ids.length}.`);
        window.setTimeout(() => setMessage(null), 2000);
      } catch {
        setMessage(`Could not ${verb.toLowerCase()}.`);
      }
    });
  }

  function runBulkDelete() {
    const ids = [...selectedIds];
    if (!ids.length) return;
    const label = ids.length === 1 ? "person" : "people";
    if (
      !confirm(
        `Are you sure you want to permanently delete ${ids.length} ${label}? This cannot be undone.\n\nOK to delete, Cancel to keep them.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      try {
        await bulkDeletePeople(ids);
        setItems((prev) => prev.filter((p) => !ids.includes(p.id)));
        setSelectedIds(new Set());
        setMessage(`Deleted ${ids.length}.`);
        window.setTimeout(() => setMessage(null), 2000);
      } catch {
        setMessage("Could not delete.");
      }
    });
  }

  function runBulkRemoveFromList() {
    if (
      !activeList ||
      (activeList.kind !== "event" && activeList.kind !== "shortcut")
    ) {
      return;
    }
    const ids = [...selectedIds];
    if (!ids.length) return;
    const kindLabel = activeList.kind === "event" ? "event" : "shortcut";
    if (
      !confirm(
        `Remove ${ids.length} ${ids.length === 1 ? "person" : "people"} from ${activeList.name}?`,
      )
    ) {
      return;
    }
    const listId = activeList.id;
    const listName = activeList.name;
    const isEvent = activeList.kind === "event";
    startTransition(async () => {
      try {
        const result = await removePeopleFromList(ids, listId);
        setItems((prev) =>
          prev.map((p) => {
            if (!ids.includes(p.id)) return p;
            const next = {
              ...p,
              memberships: p.memberships.filter((m) => m.listId !== listId),
            };
            if (isEvent && p.upcomingInviteEventId === listId) {
              return {
                ...next,
                upcomingInviteStatus: "none",
                upcomingInvitedOn: null,
                upcomingInviteEventId: null,
                sent:
                  p.sent &&
                  p.upcomingInvitedOn &&
                  p.sent === p.upcomingInvitedOn
                    ? null
                    : p.sent,
              };
            }
            return next;
          }),
        );
        setSelectedIds(new Set());
        setMessage(
          result.removed
            ? `Removed ${result.removed} from ${listName}.`
            : `No one needed removing from ${listName}.`,
        );
        window.setTimeout(() => setMessage(null), 2000);
      } catch {
        setMessage(`Could not remove from ${kindLabel}.`);
      }
    });
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <p className="brand">Mafia Club</p>
          <p className="subbrand">Invite desk</p>
        </div>
        <div className="topbar-right">
          <span className="who">Signed in as {userName}</span>
          <form action="/api/logout" method="post">
            <button type="submit" className="ghost-btn">
              Log out
            </button>
          </form>
        </div>
      </header>

      <div className="nav-row">
        <div className="nav-group nav-group-events">
          <span className="nav-group-label">Events</span>
          <nav className="tabs" aria-label="Events">
            {upcomingEvents.map((t) => (
              <button
                key={t.id}
                type="button"
                className={tabId === t.id ? "tab active" : "tab"}
                onClick={() => {
                  setTabId(t.id);
                  setMessage(null);
                }}
              >
                {t.name}
              </button>
            ))}
            <button
              type="button"
              className="tab tab-new"
              onClick={() => setNewListOpen(true)}
            >
              + New event
            </button>
          </nav>
        </div>
        <div className="nav-side">
          <PastEventsMenu
            events={pastEvents}
            activeId={isPastEventTab ? activeList?.id ?? null : null}
            onSelect={(id) => {
              setTabId(id);
              setMessage(null);
            }}
          />
          <ShortcutsMenu
            shortcuts={shortcutLists}
            activeId={
              activeList &&
              (activeList.kind === "shortcut" || activeList.kind === "archived")
                ? activeList.id
                : null
            }
            onSelect={(id) => {
              setTabId(id);
              setMessage(null);
            }}
            onCreated={(list) => {
              setLists((prev) => {
                const archived = prev.filter((l) => l.kind === "archived");
                const shortcuts = prev
                  .filter((l) => l.kind === "shortcut")
                  .concat(list)
                  .sort(
                    (a, b) =>
                      a.sortOrder - b.sortOrder ||
                      a.name.localeCompare(b.name),
                  );
                const events = prev.filter((l) => l.kind === "event");
                return [...shortcuts, ...events, ...archived];
              });
            }}
            onDeleted={(id) => {
              setLists((prev) => prev.filter((l) => l.id !== id));
              if (tabId === id) setTabId(ADDRESS_BOOK_ID);
            }}
          />
          <button
            type="button"
            className={
              isAddressBook ? "address-book-link active" : "address-book-link"
            }
            onClick={() => {
              setTabId(ADDRESS_BOOK_ID);
              setMessage(null);
            }}
          >
            Mafia Address Book
          </button>
        </div>
      </div>

      <EventFormModal
        open={newListOpen}
        onClose={() => setNewListOpen(false)}
        onSaved={(dto) => {
          upsertEventInLists(dto);
          setTabId(dto.id);
          setMessage(`Created “${dto.name}”.`);
          window.setTimeout(() => setMessage(null), 2000);
        }}
      />

      <EventFormModal
        open={editEventOpen}
        event={isEventTab ? activeList : null}
        onClose={() => setEditEventOpen(false)}
        onSaved={(dto) => {
          upsertEventInLists(dto);
          setMessage(`Updated “${dto.name}”.`);
          window.setTimeout(() => setMessage(null), 2000);
        }}
      />

      {isEventTab && activeList ? (
        <div className={`event-meta-row ${isPastEventTab ? "past" : ""}`}>
          <div>
            {isPastEventTab ? (
              <p className="event-past-badge">Past event</p>
            ) : null}
            <p className="event-meta-line">
              {eventMetaLine(activeList) || "Event details not set"}
            </p>
          </div>
          <div className="event-meta-actions">
            <label className="sort-select">
              Display
              <select
                className="filter"
                value={shortcutSort}
                onChange={(e) =>
                  setShortcutSort(e.target.value === "name" ? "name" : "rank")
                }
                aria-label="Sort event list"
              >
                <option value="rank">By ranking</option>
                <option value="name">Alphabetically</option>
              </select>
            </label>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => setEditEventOpen(true)}
            >
              Edit event
            </button>
            <button
              type="button"
              className="danger-btn"
              onClick={() => setDeleteEventConfirmOpen(true)}
            >
              Delete event
            </button>
          </div>
        </div>
      ) : null}

      {activeList &&
      (activeList.kind === "shortcut" || activeList.kind === "archived") ? (
        <header className="list-heading">
          <h2>{activeList.name}</h2>
          {isShortcutTab ? (
            <label className="sort-select">
              Display
              <select
                className="filter"
                value={shortcutSort}
                onChange={(e) =>
                  setShortcutSort(e.target.value === "name" ? "name" : "rank")
                }
                aria-label="Sort shortcut list"
              >
                <option value="rank">By ranking</option>
                <option value="name">Alphabetically</option>
              </select>
            </label>
          ) : null}
        </header>
      ) : null}

      <section className="toolbar">
        <label className="select-all">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            onChange={toggleSelectAllVisible}
            aria-label="Select all visible"
          />
          <span>Select all</span>
        </label>
        <input
          className="search"
          placeholder="Search name, email, notes…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <CategoryFilter
          selected={categories}
          matchMode={categoryMatch}
          onChange={setCategories}
          onMatchModeChange={setCategoryMatch}
        />
        <button type="button" className="primary-btn" onClick={openCreate}>
          Add person
        </button>
      </section>

      <BulkBar
        count={selectedCount}
        onClear={() => setSelectedIds(new Set())}
        onEditTags={() => setBulkTagsOpen(true)}
        onAddToEvent={() => setBulkEventOpen(true)}
        onAddToShortcut={() => setBulkShortcutOpen(true)}
        onInvite={() => {
          setInvitePersonIds([...selectedIds]);
          setInviteOpen(true);
        }}
        onArchive={() => runBulkArchive(true)}
        onUnarchive={() => runBulkArchive(false)}
        onDelete={runBulkDelete}
        onRemoveFromList={runBulkRemoveFromList}
        showRemoveFromList={isEventTab || isShortcutTab}
        removeFromListLabel={
          isShortcutTab ? "Remove from shortcut" : "Remove from event"
        }
        showUnarchive={isArchivedTab}
        showDelete={isAddressBook}
      />

      {isAddressBook ? (
        <p className="hint">
          Master address book — everyone in alphabetical order. Add people here,
          then place them onto player lists.
        </p>
      ) : null}
      {isEventTab ? (
        <p className="hint">
          Event invite list — people added here are the ones to invite for this
          game.
        </p>
      ) : null}
      {isRankedTab && !sortListByName ? (
        <p className="hint">
          Drag rows to change ranking — order saves automatically. Clear search
          and category filters to reorder.
        </p>
      ) : null}
      {isRankedTab && sortListByName ? (
        <p className="hint">
          Showing A–Z. Switch to “By ranking” to drag and reorder.
        </p>
      ) : null}
      {isArchivedTab ? (
        <p className="hint">
          Archived contacts are hidden from the other lists. Open a person and
          choose Unarchive to restore them.
        </p>
      ) : null}
      {message ? <p className="toast">{message}</p> : null}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={filtered.map((p) => p.id)}
          strategy={verticalListSortingStrategy}
          disabled={!canReorder}
        >
          <div className="list">
            {filtered.map((person, index) => (
              <PersonRow
                key={person.id}
                person={person}
                showRank={showRank}
                sortable={canReorder}
                selected={selectedIds.has(person.id)}
                onToggleSelect={toggleSelect}
                dimmed={isAddressBook && person.archived}
                rank={
                  isRankedTab && activeList
                    ? (membershipForList(person, activeList.id)?.rank ??
                      index + 1)
                    : index + 1
                }
                onEdit={openEdit}
                onInvite={invitePerson}
                onUninvite={requestUninvite}
                inviting={invitingId === person.id}
              />
            ))}
            {!filtered.length ? (
              <p className="empty">No people match this view.</p>
            ) : null}
          </div>
        </SortableContext>
      </DndContext>

      <PersonEditor
        open={editorOpen}
        person={editing}
        listId={isAddressBook ? null : (activeList?.id ?? null)}
        allowDelete={isAddressBook}
        attendanceEvents={attendanceEvents}
        onClose={() => setEditorOpen(false)}
      />

      <AddPersonMenu
        open={addMenuOpen}
        onClose={() => setAddMenuOpen(false)}
        onNewContact={() => {
          setAddMenuOpen(false);
          setEditing(null);
          setEditorOpen(true);
        }}
        onFromAddressBook={() => {
          setAddMenuOpen(false);
          setPickerOpen(true);
        }}
      />

      {activeList ? (
        <AddressBookPicker
          open={pickerOpen}
          people={items}
          listId={activeList.id}
          onClose={() => setPickerOpen(false)}
          onAdded={handlePickedFromBook}
        />
      ) : null}

      <BulkTagsModal
        open={bulkTagsOpen}
        personIds={[...selectedIds]}
        onClose={() => setBulkTagsOpen(false)}
        onSaved={(add, remove) => {
          setItems((prev) =>
            prev.map((p) => {
              if (!selectedIds.has(p.id)) return p;
              const next = { ...p };
              for (const key of add) next[key] = true;
              for (const key of remove) next[key] = false;
              return next;
            }),
          );
          setMessage(
            `Updated tags on ${selectedIds.size} ${selectedIds.size === 1 ? "person" : "people"}.`,
          );
          setSelectedIds(new Set());
          window.setTimeout(() => setMessage(null), 2000);
        }}
      />

      <BulkEventModal
        open={bulkEventOpen}
        personIds={[...selectedIds]}
        events={[...upcomingEvents, ...pastEvents]}
        preferredEventId={isEventTab ? activeList?.id : null}
        onClose={() => setBulkEventOpen(false)}
        onSaved={(event, added) => {
          applyAddedToEvent(event, [...selectedIds], added, false);
        }}
      />

      <BulkEventModal
        open={bulkShortcutOpen}
        personIds={[...selectedIds]}
        events={addableShortcuts}
        preferredEventId={isShortcutTab ? activeList?.id : null}
        mode="shortcut"
        onClose={() => setBulkShortcutOpen(false)}
        onSaved={(list, added) => {
          applyAddedToEvent(list, [...selectedIds], added, false);
        }}
      />

      <BulkEventModal
        open={inviteOpen}
        personIds={invitePersonIds}
        events={upcomingEvents}
        preferredEventId={
          isEventTab && !isPastEventTab ? activeList?.id : null
        }
        mode="invite"
        onClose={() => setInviteOpen(false)}
        onSaved={(event, added) => {
          applyAddedToEvent(event, invitePersonIds, added, true);
        }}
      />

      <ConfirmDialog
        open={Boolean(uninvitePerson)}
        message="Are you sure? This person will be removed from your event."
        confirmLabel="Yes"
        cancelLabel="Cancel"
        onConfirm={confirmUninvite}
        onCancel={() => setUninvitePerson(null)}
      />

      <ConfirmDialog
        open={archiveConfirmOpen}
        message={
          selectedIds.size === 1
            ? "Are you sure? Archiving this contact will hide them from your other lists"
            : "Are you sure? Archiving these contacts will hide them from your other lists"
        }
        confirmLabel="Yes"
        cancelLabel="Cancel"
        onConfirm={() => applyBulkArchive(true, [...selectedIds])}
        onCancel={() => setArchiveConfirmOpen(false)}
      />

      <ConfirmDialog
        open={deleteEventConfirmOpen}
        message={
          activeList
            ? `Are you sure you want to delete “${activeList.name}”? People stay in the address book; they’re only removed from this event list.`
            : "Are you sure you want to delete this event?"
        }
        confirmLabel="Yes"
        cancelLabel="Cancel"
        onConfirm={() => {
          if (!activeList || activeList.kind !== "event") return;
          const id = activeList.id;
          const name = activeList.name;
          setDeleteEventConfirmOpen(false);
          startTransition(async () => {
            try {
              await deleteGuestList(id);
              setLists((prev) => prev.filter((l) => l.id !== id));
              setTabId(ADDRESS_BOOK_ID);
              setMessage(`Deleted “${name}”.`);
              window.setTimeout(() => setMessage(null), 2000);
            } catch (e) {
              setMessage(
                e instanceof Error ? e.message : "Could not delete event.",
              );
            }
          });
        }}
        onCancel={() => setDeleteEventConfirmOpen(false)}
      />
    </div>
  );
}
