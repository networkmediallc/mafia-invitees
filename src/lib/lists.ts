import { prisma } from "@/lib/db";
import {
  toGuestListDTO,
  type GuestListDTO,
  type ListKind,
} from "@/lib/list-kinds";

export type { GuestListDTO, ListKind };
export { toGuestListDTO, slugifyListName, isRankedKind } from "@/lib/list-kinds";

const DEFAULT_LISTS: {
  name: string;
  slug: string;
  kind: ListKind;
  sortOrder: number;
}[] = [
  {
    name: "LA Players",
    slug: "los-angeles",
    kind: "shortcut",
    sortOrder: 0,
  },
  {
    name: "Vegas Players",
    slug: "vegas",
    kind: "shortcut",
    sortOrder: 1,
  },
  {
    name: "Archived",
    slug: "archived",
    kind: "archived",
    sortOrder: 100,
  },
];

/** Ensure default lists exist and backfill memberships from legacy flags once. */
export async function ensureGuestLists() {
  for (const def of DEFAULT_LISTS) {
    await prisma.guestList.upsert({
      where: { slug: def.slug },
      create: def,
      update: {
        name: def.name,
        kind: def.kind,
        sortOrder: def.sortOrder,
      },
    });
  }

  // Migrate any leftover ranked lists into shortcut/event
  await prisma.guestList.updateMany({
    where: { kind: "ranked", slug: { in: ["los-angeles", "vegas"] } },
    data: { kind: "shortcut" },
  });
  await prisma.guestList.updateMany({
    where: {
      kind: "ranked",
      NOT: { slug: { in: ["los-angeles", "vegas", "archived"] } },
    },
    data: { kind: "event" },
  });

  // One-time rename if an older "quick" slug exists
  const quick = await prisma.guestList.findUnique({ where: { slug: "quick" } });
  if (quick) {
    const la = await prisma.guestList.findUnique({
      where: { slug: "los-angeles" },
    });
    if (la) {
      await prisma.listMembership.updateMany({
        where: { listId: quick.id },
        data: { listId: la.id },
      });
      await prisma.guestList.delete({ where: { id: quick.id } });
    } else {
      await prisma.guestList.update({
        where: { id: quick.id },
        data: {
          name: "LA Players",
          slug: "los-angeles",
          kind: "shortcut",
          sortOrder: 0,
        },
      });
    }
  }

  const meta = await prisma.appMeta.findUnique({
    where: { key: "lists_backfilled" },
  });
  if (meta?.value === "1") return;

  const lists = await prisma.guestList.findMany();
  const bySlug = Object.fromEntries(lists.map((l) => [l.slug, l]));

  const la = bySlug["los-angeles"];
  const vegas = bySlug["vegas"];
  const archived = bySlug["archived"];

  if (la) {
    const people = await prisma.person.findMany({
      where: { onQuickList: true },
      select: { id: true, quickRank: true },
    });
    for (const p of people) {
      await prisma.listMembership.upsert({
        where: {
          personId_listId: { personId: p.id, listId: la.id },
        },
        create: {
          personId: p.id,
          listId: la.id,
          rank: p.quickRank,
        },
        update: { rank: p.quickRank },
      });
    }
  }

  if (vegas) {
    const people = await prisma.person.findMany({
      where: { onVegas: true },
      select: { id: true, vegasRank: true },
    });
    for (const p of people) {
      await prisma.listMembership.upsert({
        where: {
          personId_listId: { personId: p.id, listId: vegas.id },
        },
        create: {
          personId: p.id,
          listId: vegas.id,
          rank: p.vegasRank,
        },
        update: { rank: p.vegasRank },
      });
    }
  }

  if (archived) {
    const people = await prisma.person.findMany({
      where: { archived: true },
      select: { id: true },
    });
    for (const p of people) {
      await prisma.listMembership.upsert({
        where: {
          personId_listId: { personId: p.id, listId: archived.id },
        },
        create: {
          personId: p.id,
          listId: archived.id,
          rank: null,
        },
        update: {},
      });
    }
  }

  await prisma.appMeta.upsert({
    where: { key: "lists_backfilled" },
    create: { key: "lists_backfilled", value: "1" },
    update: { value: "1" },
  });
}

export async function getGuestLists(): Promise<GuestListDTO[]> {
  await ensureGuestLists();
  await syncRegionListsFromTags();
  const lists = await prisma.guestList.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return lists.map(toGuestListDTO);
}

/**
 * LA Mafia tag → LA Players; Vegas Mafia tag → Vegas Players.
 * Archived people are skipped (and left off those shortcuts).
 */
export async function syncRegionListsFromTags(personIds?: string[]) {
  const la = await prisma.guestList.findUnique({ where: { slug: "los-angeles" } });
  const vegas = await prisma.guestList.findUnique({ where: { slug: "vegas" } });
  if (!la || !vegas) return;

  const idFilter = personIds?.length
    ? { id: { in: [...new Set(personIds)] } }
    : {};

  const people = await prisma.person.findMany({
    where: {
      ...idFilter,
      archived: false,
      OR: [{ laMafia: true }, { vegasMafia: true }],
    },
    select: {
      id: true,
      laMafia: true,
      vegasMafia: true,
      memberships: { select: { listId: true } },
    },
  });

  for (const person of people) {
    const memberIds = new Set(person.memberships.map((m) => m.listId));

    if (person.laMafia && !memberIds.has(la.id)) {
      const rank = await nextRank(la.id);
      await prisma.listMembership.create({
        data: { personId: person.id, listId: la.id, rank },
      });
      await prisma.person.update({
        where: { id: person.id },
        data: { onQuickList: true, quickRank: rank },
      });
    }

    if (person.vegasMafia && !memberIds.has(vegas.id)) {
      const rank = await nextRank(vegas.id);
      await prisma.listMembership.create({
        data: { personId: person.id, listId: vegas.id, rank },
      });
      await prisma.person.update({
        where: { id: person.id },
        data: { onVegas: true, vegasRank: rank },
      });
    }
  }
}

async function nextRank(listId: string) {
  const existing = await prisma.listMembership.findMany({
    where: { listId },
    select: { rank: true },
  });
  const ranks = existing.map((m) => m.rank ?? 0);
  return (ranks.length ? Math.max(...ranks) : 0) + 1;
}
