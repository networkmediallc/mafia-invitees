"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSession } from "@/lib/auth";
import { CATEGORIES, type CategoryKey } from "@/lib/categories";
import { prisma } from "@/lib/db";
import { slugifyListName, toGuestListDTO } from "@/lib/list-kinds";
import { syncRegionListsFromTags } from "@/lib/lists";
import { attendanceSummaryFromStatuses } from "@/lib/people";

const categoryKeys = CATEGORIES.map((c) => c.key) as [
  CategoryKey,
  ...CategoryKey[],
];

const categoryShape = Object.fromEntries(
  categoryKeys.map((key) => [key, z.boolean().optional().default(false)]),
) as Record<CategoryKey, z.ZodDefault<z.ZodOptional<z.ZodBoolean>>>;

const personInput = z.object({
  firstName: z.string().min(1),
  lastName: z.string().optional().default(""),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
  plusOnes: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  whoIsThis: z.string().optional().nullable(),
  attended: z.string().optional().nullable(),
  previousPlayer: z.boolean().optional().default(false),
  sent: z.string().optional().nullable(),
  ...categoryShape,
  event1Rsvp: z.string().optional().nullable(),
  event2Rsvp: z.string().optional().nullable(),
  event3Rsvp: z.string().optional().nullable(),
});

function categoryData(data: z.infer<typeof personInput>) {
  return Object.fromEntries(
    categoryKeys.map((key) => [key, data[key] ?? false]),
  ) as Record<CategoryKey, boolean>;
}

function emptyToNull(value: string | null | undefined) {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function formatArchiveDate(date = new Date()) {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

function formatInviteDate(date = new Date()) {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

async function nextRankForList(listId: string) {
  const existing = await prisma.listMembership.findMany({
    where: { listId },
    select: { rank: true },
  });
  const ranks = existing.map((m) => m.rank ?? 0);
  return (ranks.length ? Math.max(...ranks) : 0) + 1;
}

async function getArchivedList() {
  return prisma.guestList.findUniqueOrThrow({ where: { slug: "archived" } });
}

export async function createGuestList(
  name: string,
  kind: "event" | "shortcut" = "event",
  details?: {
    eventDate?: string | null;
    venue?: string | null;
    city?: string | null;
  },
) {
  await requireSession();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name is required.");

  const eventDate = details?.eventDate?.trim() || null;
  const venue = details?.venue?.trim() || null;
  const city = details?.city?.trim() || null;

  if (kind === "event") {
    if (!eventDate) throw new Error("Event date is required.");
    if (!venue) throw new Error("Venue is required.");
    if (!city) throw new Error("City is required.");
  }

  const base = slugifyListName(trimmed);
  let slug = base;
  let n = 2;
  while (await prisma.guestList.findUnique({ where: { slug } })) {
    slug = `${base}-${n}`;
    n += 1;
  }

  const siblings = await prisma.guestList.findMany({
    where: { kind },
    select: { sortOrder: true },
  });
  const sortOrder = siblings.length
    ? Math.max(...siblings.map((l) => l.sortOrder)) + 1
    : kind === "event"
      ? 10
      : 2;

  const list = await prisma.guestList.create({
    data: {
      name: trimmed,
      slug,
      kind,
      sortOrder,
      eventDate: kind === "event" ? eventDate : null,
      venue: kind === "event" ? venue : null,
      city: kind === "event" ? city : null,
    },
  });

  if (kind === "event") {
    await ensureGameEventForList(list);
  }

  revalidatePath("/");
  return toGuestListDTO(list);
}

export async function updateEvent(
  listId: string,
  details: {
    name: string;
    eventDate: string;
    venue: string;
    city: string;
  },
) {
  await requireSession();
  const list = await prisma.guestList.findUniqueOrThrow({
    where: { id: listId },
  });
  if (list.kind !== "event") {
    throw new Error("Only events can be edited here.");
  }

  const name = details.name.trim();
  const eventDate = details.eventDate.trim();
  const venue = details.venue.trim();
  const city = details.city.trim();

  if (!name) throw new Error("Name is required.");
  if (!eventDate) throw new Error("Event date is required.");
  if (!venue) throw new Error("Venue is required.");
  if (!city) throw new Error("City is required.");

  const updated = await prisma.guestList.update({
    where: { id: listId },
    data: { name, eventDate, venue, city },
  });

  await ensureGameEventForList(updated);

  revalidatePath("/");
  return toGuestListDTO(updated);
}

export async function deleteGuestList(listId: string) {
  await requireSession();
  const list = await prisma.guestList.findUniqueOrThrow({
    where: { id: listId },
  });
  if (list.slug === "archived" || list.kind === "archived") {
    throw new Error("The Archived shortcut can’t be deleted.");
  }
  await prisma.guestList.delete({ where: { id: listId } });
  revalidatePath("/");
  return { id: listId };
}

export async function createPerson(
  listId: string | null,
  raw: z.infer<typeof personInput>,
) {
  const session = await requireSession();
  const data = personInput.parse(raw);

  if (!listId) {
    const person = await prisma.person.create({
      data: {
        firstName: data.firstName.trim(),
        lastName: (data.lastName ?? "").trim(),
        email: emptyToNull(data.email),
        phone: emptyToNull(data.phone),
        title: emptyToNull(data.title),
        plusOnes: emptyToNull(data.plusOnes),
        notes: emptyToNull(data.notes),
        whoIsThis: emptyToNull(data.whoIsThis),
        attended: emptyToNull(data.attended),
        previousPlayer: data.previousPlayer,
        sent: emptyToNull(data.sent),
        ...categoryData(data),
        event1Rsvp: emptyToNull(data.event1Rsvp),
        event2Rsvp: emptyToNull(data.event2Rsvp),
        event3Rsvp: emptyToNull(data.event3Rsvp),
        lastEditedBy: session.name,
      },
    });
    await syncRegionListsFromTags([person.id]);
    revalidatePath("/");
    return person;
  }

  const list = await prisma.guestList.findUniqueOrThrow({
    where: { id: listId },
  });

  const isArchived = list.kind === "archived";
  const rank = isArchived ? null : await nextRankForList(list.id);

  const person = await prisma.person.create({
    data: {
      firstName: data.firstName.trim(),
      lastName: (data.lastName ?? "").trim(),
      email: emptyToNull(data.email),
      phone: emptyToNull(data.phone),
      title: emptyToNull(data.title),
      plusOnes: emptyToNull(data.plusOnes),
      notes: emptyToNull(data.notes),
      whoIsThis: emptyToNull(data.whoIsThis),
      attended: emptyToNull(data.attended),
      previousPlayer: data.previousPlayer,
      sent: emptyToNull(data.sent),
      ...categoryData(data),
      event1Rsvp: emptyToNull(data.event1Rsvp),
      event2Rsvp: emptyToNull(data.event2Rsvp),
      event3Rsvp: emptyToNull(data.event3Rsvp),
      archived: isArchived,
      archivedAt: isArchived ? formatArchiveDate() : null,
      // Keep legacy flags in sync for known lists
      onQuickList: list.slug === "los-angeles",
      quickRank: list.slug === "los-angeles" ? rank : null,
      onVegas: list.slug === "vegas",
      vegasRank: list.slug === "vegas" ? rank : null,
      lastEditedBy: session.name,
      memberships: {
        create: {
          listId: list.id,
          rank,
        },
      },
    },
  });

  if (!isArchived) await syncRegionListsFromTags([person.id]);
  revalidatePath("/");
  return person;
}

export async function addPersonToList(personId: string, listId: string) {
  await addPeopleToList([personId], listId);
  return prisma.person.findUniqueOrThrow({ where: { id: personId } });
}

export async function addPeopleToList(personIds: string[], listId: string) {
  const session = await requireSession();
  const uniqueIds = [...new Set(personIds.filter(Boolean))];
  if (!uniqueIds.length) return { added: 0 };

  const list = await prisma.guestList.findUniqueOrThrow({
    where: { id: listId },
  });

  if (list.kind === "archived") {
    for (const id of uniqueIds) {
      await setPersonArchived(id, true);
    }
    revalidatePath("/");
    return { added: uniqueIds.length };
  }

  let added = 0;
  for (const personId of uniqueIds) {
    const person = await prisma.person.findUniqueOrThrow({
      where: { id: personId },
    });
    const existing = await prisma.listMembership.findUnique({
      where: { personId_listId: { personId, listId } },
    });
    if (existing) continue;

    const rank = await nextRankForList(listId);
    await prisma.listMembership.create({
      data: { personId, listId, rank },
    });

    if (person.archived) {
      await setPersonArchived(personId, false);
    }

    if (list.slug === "los-angeles") {
      await prisma.person.update({
        where: { id: personId },
        data: {
          onQuickList: true,
          quickRank: rank,
          lastEditedBy: session.name,
        },
      });
    } else if (list.slug === "vegas") {
      await prisma.person.update({
        where: { id: personId },
        data: {
          onVegas: true,
          vegasRank: rank,
          lastEditedBy: session.name,
        },
      });
    } else {
      await prisma.person.update({
        where: { id: personId },
        data: { lastEditedBy: session.name },
      });
    }
    added += 1;
  }

  revalidatePath("/");
  return { added };
}

export async function bulkUpdateCategories(
  personIds: string[],
  add: CategoryKey[],
  remove: CategoryKey[],
) {
  const session = await requireSession();
  const uniqueIds = [...new Set(personIds.filter(Boolean))];
  if (!uniqueIds.length) return { updated: 0 };

  const addKeys = add.filter((k) => categoryKeys.includes(k));
  const removeKeys = remove.filter((k) => categoryKeys.includes(k));
  if (!addKeys.length && !removeKeys.length) return { updated: 0 };

  const data = {
    ...Object.fromEntries(addKeys.map((k) => [k, true])),
    ...Object.fromEntries(removeKeys.map((k) => [k, false])),
    lastEditedBy: session.name,
  };

  await prisma.$transaction(
    uniqueIds.map((id) =>
      prisma.person.update({
        where: { id },
        data,
      }),
    ),
  );

  await syncRegionListsFromTags(uniqueIds);
  revalidatePath("/");
  return { updated: uniqueIds.length };
}

export async function updatePerson(
  id: string,
  raw: Partial<z.infer<typeof personInput>>,
) {
  const session = await requireSession();
  const data = personInput.partial().parse(raw);

  const person = await prisma.person.update({
    where: { id },
    data: {
      ...(data.firstName !== undefined
        ? { firstName: data.firstName.trim() }
        : {}),
      ...(data.lastName !== undefined
        ? { lastName: data.lastName.trim() }
        : {}),
      ...(data.email !== undefined ? { email: emptyToNull(data.email) } : {}),
      ...(data.phone !== undefined ? { phone: emptyToNull(data.phone) } : {}),
      ...(data.title !== undefined ? { title: emptyToNull(data.title) } : {}),
      ...(data.plusOnes !== undefined
        ? { plusOnes: emptyToNull(data.plusOnes) }
        : {}),
      ...(data.notes !== undefined ? { notes: emptyToNull(data.notes) } : {}),
      ...(data.whoIsThis !== undefined
        ? { whoIsThis: emptyToNull(data.whoIsThis) }
        : {}),
      ...(data.attended !== undefined
        ? { attended: emptyToNull(data.attended) }
        : {}),
      ...(data.previousPlayer !== undefined
        ? { previousPlayer: data.previousPlayer }
        : {}),
      ...(data.sent !== undefined ? { sent: emptyToNull(data.sent) } : {}),
      ...Object.fromEntries(
        categoryKeys
          .filter((key) => data[key] !== undefined)
          .map((key) => [key, data[key]]),
      ),
      ...(data.event1Rsvp !== undefined
        ? { event1Rsvp: emptyToNull(data.event1Rsvp) }
        : {}),
      ...(data.event2Rsvp !== undefined
        ? { event2Rsvp: emptyToNull(data.event2Rsvp) }
        : {}),
      ...(data.event3Rsvp !== undefined
        ? { event3Rsvp: emptyToNull(data.event3Rsvp) }
        : {}),
      lastEditedBy: session.name,
    },
  });

  await syncRegionListsFromTags([person.id]);
  revalidatePath("/");
  return person;
}

export async function deletePerson(id: string) {
  await requireSession();
  await prisma.person.delete({ where: { id } });
  revalidatePath("/");
}

export async function bulkDeletePeople(personIds: string[]) {
  await requireSession();
  const uniqueIds = [...new Set(personIds.filter(Boolean))];
  if (!uniqueIds.length) return { deleted: 0 };
  await prisma.person.deleteMany({ where: { id: { in: uniqueIds } } });
  revalidatePath("/");
  return { deleted: uniqueIds.length };
}

export async function bulkSetArchived(personIds: string[], archived: boolean) {
  const uniqueIds = [...new Set(personIds.filter(Boolean))];
  if (!uniqueIds.length) return { updated: 0 };
  for (const id of uniqueIds) {
    await setPersonArchived(id, archived);
  }
  revalidatePath("/");
  return { updated: uniqueIds.length };
}

export async function removePeopleFromList(personIds: string[], listId: string) {
  const session = await requireSession();
  const uniqueIds = [...new Set(personIds.filter(Boolean))];
  if (!uniqueIds.length) return { removed: 0 };

  const list = await prisma.guestList.findUniqueOrThrow({
    where: { id: listId },
  });
  if (list.kind === "archived") {
    throw new Error("Use Unarchive instead of removing from Archived.");
  }

  const result = await prisma.listMembership.deleteMany({
    where: { listId, personId: { in: uniqueIds } },
  });

  if (list.kind === "event") {
    const invited = await prisma.person.findMany({
      where: {
        id: { in: uniqueIds },
        upcomingInviteEventId: listId,
      },
    });
    for (const person of invited) {
      await prisma.person.update({
        where: { id: person.id },
        data: {
          upcomingInviteStatus: "none",
          upcomingInvitedOn: null,
          upcomingInviteEventId: null,
          sent:
            person.sent &&
            person.upcomingInvitedOn &&
            person.sent === person.upcomingInvitedOn
              ? null
              : person.sent,
          lastEditedBy: session.name,
        },
      });
    }
  }

  if (list.slug === "los-angeles") {
    await prisma.person.updateMany({
      where: { id: { in: uniqueIds } },
      data: {
        onQuickList: false,
        quickRank: null,
        lastEditedBy: session.name,
      },
    });
  } else if (list.slug === "vegas") {
    await prisma.person.updateMany({
      where: { id: { in: uniqueIds } },
      data: {
        onVegas: false,
        vegasRank: null,
        lastEditedBy: session.name,
      },
    });
  } else {
    await prisma.person.updateMany({
      where: { id: { in: uniqueIds } },
      data: { lastEditedBy: session.name },
    });
  }

  revalidatePath("/");
  return { removed: result.count };
}

export async function saveListOrder(listId: string, orderedIds: string[]) {
  const session = await requireSession();
  const list = await prisma.guestList.findUniqueOrThrow({
    where: { id: listId },
  });
  if (list.kind === "archived") return;

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.listMembership.upsert({
        where: {
          personId_listId: { personId: id, listId },
        },
        create: {
          personId: id,
          listId,
          rank: index + 1,
        },
        update: {
          rank: index + 1,
        },
      }),
    ),
  );

  // Legacy sync for known lists
  if (list.slug === "los-angeles" || list.slug === "vegas") {
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.person.update({
          where: { id },
          data:
            list.slug === "los-angeles"
              ? {
                  onQuickList: true,
                  quickRank: index + 1,
                  lastEditedBy: session.name,
                }
              : {
                  onVegas: true,
                  vegasRank: index + 1,
                  lastEditedBy: session.name,
                },
        }),
      ),
    );
  } else {
    await prisma.person.updateMany({
      where: { id: { in: orderedIds } },
      data: { lastEditedBy: session.name },
    });
  }

  revalidatePath("/");
}

export async function invitePeopleToEvent(personIds: string[], listId: string) {
  const session = await requireSession();
  const list = await prisma.guestList.findUniqueOrThrow({
    where: { id: listId },
  });
  if (list.kind !== "event") {
    throw new Error("Pick an event to invite people to.");
  }

  const result = await addPeopleToList(personIds, listId);
  const uniqueIds = [...new Set(personIds.filter(Boolean))];

  await prisma.person.updateMany({
    where: { id: { in: uniqueIds } },
    data: {
      upcomingInviteStatus: "selected",
      upcomingInviteEventId: listId,
      upcomingInvitedOn: null,
      lastEditedBy: session.name,
    },
  });

  revalidatePath("/");
  return { ...result, eventId: listId };
}

export async function markUpcomingInvited(id: string) {
  const session = await requireSession();
  const person = await prisma.person.findUniqueOrThrow({ where: { id } });
  const status = person.upcomingInviteStatus || "none";
  if (status !== "selected") {
    throw new Error("Mark them Pending first by inviting to an event.");
  }

  const upcomingInvitedOn = formatInviteDate();
  await prisma.person.update({
    where: { id },
    data: {
      upcomingInviteStatus: "invited",
      upcomingInvitedOn,
      sent: upcomingInvitedOn,
      lastEditedBy: session.name,
    },
  });

  revalidatePath("/");
  return {
    id,
    upcomingInviteStatus: "invited",
    upcomingInvitedOn,
    upcomingInviteEventId: person.upcomingInviteEventId,
  };
}

export async function resetUpcomingInvite(
  id: string,
  fallbackEventId?: string | null,
) {
  const session = await requireSession();
  const person = await prisma.person.findUniqueOrThrow({ where: { id } });

  let eventId =
    person.upcomingInviteEventId || fallbackEventId?.trim() || null;

  if (!eventId) {
    const eventMemberships = await prisma.listMembership.findMany({
      where: { personId: id, list: { kind: "event" } },
      select: { listId: true },
      take: 2,
    });
    if (eventMemberships.length === 1) {
      eventId = eventMemberships[0].listId;
    }
  }

  if (eventId) {
    await prisma.listMembership.deleteMany({
      where: { personId: id, listId: eventId },
    });
  }

  await prisma.person.update({
    where: { id },
    data: {
      upcomingInviteStatus: "none",
      upcomingInvitedOn: null,
      upcomingInviteEventId: null,
      sent:
        person.sent &&
        person.upcomingInvitedOn &&
        person.sent === person.upcomingInvitedOn
          ? null
          : person.sent,
      lastEditedBy: session.name,
    },
  });

  revalidatePath("/");
  return {
    id,
    removedFromEventId: eventId,
    upcomingInviteStatus: "none" as const,
    upcomingInvitedOn: null,
    upcomingInviteEventId: null,
  };
}

export async function setPersonArchived(id: string, archived: boolean) {
  const session = await requireSession();
  const archivedList = await getArchivedList();

  const updated = await prisma.person.update({
    where: { id },
    data: {
      archived,
      archivedAt: archived ? formatArchiveDate() : null,
      lastEditedBy: session.name,
    },
  });

  if (archived) {
    await prisma.listMembership.upsert({
      where: {
        personId_listId: { personId: id, listId: archivedList.id },
      },
      create: {
        personId: id,
        listId: archivedList.id,
        rank: null,
      },
      update: {},
    });
  } else {
    await prisma.listMembership.deleteMany({
      where: { personId: id, listId: archivedList.id },
    });
    await syncRegionListsFromTags([id]);
  }

  revalidatePath("/");
  return updated;
}

const attendanceStatusSchema = z.enum([
  "attended",
  "did_not_attend",
  "not_on_mailing_list",
  "",
]);

async function ensureGameEventForList(list: {
  name: string;
  slug: string;
  sortOrder: number;
}) {
  return prisma.gameEvent.upsert({
    where: { slug: list.slug },
    create: {
      name: list.name,
      slug: list.slug,
      sortOrder: list.sortOrder,
    },
    update: {
      name: list.name,
      sortOrder: list.sortOrder,
    },
  });
}

export async function setPersonAttendances(
  personId: string,
  rows: {
    eventId?: string | null;
    guestListId?: string | null;
    slug?: string | null;
    name?: string | null;
    status: string;
  }[],
) {
  const session = await requireSession();
  await prisma.person.findUniqueOrThrow({ where: { id: personId } });

  for (const row of rows) {
    const parsed = attendanceStatusSchema.parse(row.status ?? "");
    let eventId = row.eventId?.trim() || null;

    if (!eventId && row.guestListId) {
      const list = await prisma.guestList.findUniqueOrThrow({
        where: { id: row.guestListId },
      });
      if (list.kind !== "event") {
        throw new Error("Attendance can only be set for events.");
      }
      const gameEvent = await ensureGameEventForList(list);
      eventId = gameEvent.id;
    }

    if (!eventId && row.slug && row.name) {
      const gameEvent = await prisma.gameEvent.upsert({
        where: { slug: row.slug },
        create: {
          name: row.name,
          slug: row.slug,
          sortOrder: 0,
        },
        update: { name: row.name },
      });
      eventId = gameEvent.id;
    }

    if (!eventId) continue;

    if (!parsed) {
      await prisma.eventAttendance.deleteMany({
        where: { personId, eventId },
      });
      continue;
    }

    await prisma.eventAttendance.upsert({
      where: {
        personId_eventId: { personId, eventId },
      },
      create: { personId, eventId, status: parsed },
      update: { status: parsed },
    });
  }

  const all = await prisma.eventAttendance.findMany({
    where: { personId },
    select: { status: true },
  });
  const summary = attendanceSummaryFromStatuses(all.map((a) => a.status));

  await prisma.person.update({
    where: { id: personId },
    data: {
      ...summary,
      lastEditedBy: session.name,
    },
  });

  revalidatePath("/");
  return { personId };
}
