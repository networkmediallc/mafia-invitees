/**
 * Reconcile AddressBook.csv into the existing DB.
 *
 * - Match by email, then normalized name
 * - Update tags / contact fields / attendance from CSV (CSV wins for those)
 * - Create people who exist only in the CSV
 * - Leave DB-only people untouched
 *
 * Usage: npx tsx scripts/reconcile-addressbook.ts [path/to/AddressBook.csv]
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  CATEGORIES,
  GROUP_TAG_TO_CATEGORY,
  normalizeGroupTags,
  type CategoryKey,
} from "../src/lib/categories";

function resolveDatabaseUrl() {
  const raw = process.env.DATABASE_URL ?? "file:../data/mafia.db";
  if (!raw.startsWith("file:")) return raw;
  const filePath = raw.slice("file:".length);
  if (path.isAbsolute(filePath)) return raw;
  const absolute = path.resolve(process.cwd(), "prisma", filePath);
  return `file:${absolute}`;
}

const adapter = new PrismaBetterSqlite3({ url: resolveDatabaseUrl() });
const prisma = new PrismaClient({ adapter });

const CONTACT_COLS = new Set([
  "Email",
  "First Name",
  "Last Name",
  "Group Tag",
  "Phone",
  "Linked Contacts",
]);

/** Categories driven by Address Book tags (do not clear these from CSV). */
const PRESERVE_CATEGORIES = new Set<CategoryKey>(["outOfTown", "formerPlayer"]);

type CategoryFlags = Record<CategoryKey, boolean>;

function emptyCategoryFlags(): CategoryFlags {
  return Object.fromEntries(
    CATEGORIES.map((c) => [c.key, false]),
  ) as CategoryFlags;
}

function categoriesFromTags(tags: string[]): CategoryFlags {
  const flags = emptyCategoryFlags();
  for (const tag of tags) {
    const key = GROUP_TAG_TO_CATEGORY[tag];
    if (key) flags[key] = true;
  }
  return flags;
}

/** CSV-derived category fields only (keeps formerPlayer / outOfTown untouched). */
function csvCategoryUpdate(flags: CategoryFlags) {
  return Object.fromEntries(
    CATEGORIES.filter((c) => !PRESERVE_CATEGORIES.has(c.key)).map((c) => [
      c.key,
      flags[c.key],
    ]),
  ) as Partial<CategoryFlags>;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    if (ch === "\r") continue;
    cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function clean(value: string | undefined | null) {
  let v = (value ?? "").trim();
  if (v.startsWith('"') && v.endsWith('"') && v.length >= 2) {
    v = v.slice(1, -1).replace(/""/g, '"').trim();
  }
  return v || null;
}

function normEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() || null;
}

function slugify(name: string) {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "event"
  );
}

function nameKeys(first: string, last: string) {
  const f = first.trim().toLowerCase();
  const l = last.trim().toLowerCase();
  const strip = (s: string) =>
    s
      .replace(/\([^)]*\)/g, " ")
      .split("|")[0]
      .replace(/["']/g, "")
      .replace(/\s+/g, " ")
      .trim();
  const f2 = strip(f);
  const l2 = strip(l);
  const keys = new Set<string>();
  for (const [a, b] of [
    [f, l],
    [f2, l2],
  ] as const) {
    keys.add(`${a}|${b}`);
    if (!b && a.includes(" ")) {
      const parts = a.split(" ");
      keys.add(`${parts[0]}|${parts.slice(1).join(" ")}`);
      keys.add(`${parts.slice(0, -1).join(" ")}|${parts[parts.length - 1]}`);
    }
  }
  keys.delete("|");
  return keys;
}

function parseTags(raw: string | null) {
  if (!raw) return [] as string[];
  return raw
    .split(";")
    .map((t) => t.trim())
    .filter(Boolean);
}

function normalizeAttendanceStatus(raw: string | null) {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "attended") return "attended";
  if (v === "did not attend") return "did_not_attend";
  if (v === "not on mailing list") return "not_on_mailing_list";
  return null;
}

function attendanceSummary(statuses: string[]) {
  if (statuses.includes("attended")) {
    return { attended: "Yes", previousPlayer: true };
  }
  if (statuses.includes("did_not_attend")) {
    return { attended: "No", previousPlayer: false };
  }
  return { attended: null as string | null, previousPlayer: false };
}

async function nextRank(listId: string) {
  const existing = await prisma.listMembership.findMany({
    where: { listId },
    select: { rank: true },
  });
  const ranks = existing.map((m) => m.rank ?? 0);
  return (ranks.length ? Math.max(...ranks) : 0) + 1;
}

async function ensureMembership(
  personId: string,
  listId: string,
  legacy?: { onQuickList?: boolean; onVegas?: boolean },
) {
  const existing = await prisma.listMembership.findUnique({
    where: { personId_listId: { personId, listId } },
  });
  if (existing) return;
  const rank = await nextRank(listId);
  await prisma.listMembership.create({
    data: { personId, listId, rank },
  });
  if (legacy?.onQuickList) {
    await prisma.person.update({
      where: { id: personId },
      data: { onQuickList: true, quickRank: rank },
    });
  }
  if (legacy?.onVegas) {
    await prisma.person.update({
      where: { id: personId },
      data: { onVegas: true, vegasRank: rank },
    });
  }
}

async function main() {
  const csvPath = process.argv[2] ?? path.join(process.cwd(), "AddressBook.csv");
  const text = readFileSync(csvPath, "utf8").replace(/^\uFEFF/, "");
  const table = parseCsv(text);
  if (!table.length) throw new Error("Empty CSV");

  const header = table[0];
  const emailIdx = header.indexOf("Email");
  const firstIdx = header.indexOf("First Name");
  const lastIdx = header.indexOf("Last Name");
  const tagIdx = header.indexOf("Group Tag");
  const phoneIdx = header.indexOf("Phone");
  const linkedIdx = header.indexOf("Linked Contacts");
  if ([emailIdx, firstIdx, lastIdx, tagIdx].some((i) => i < 0)) {
    throw new Error("CSV missing required columns");
  }

  const eventCols = header
    .map((name, index) => ({ name, index }))
    .filter(({ name }) => !CONTACT_COLS.has(name) && name.trim());

  const la = await prisma.guestList.upsert({
    where: { slug: "los-angeles" },
    create: {
      name: "LA Players",
      slug: "los-angeles",
      kind: "shortcut",
      sortOrder: 0,
    },
    update: {},
  });
  const vegas = await prisma.guestList.upsert({
    where: { slug: "vegas" },
    create: {
      name: "Vegas Players",
      slug: "vegas",
      kind: "shortcut",
      sortOrder: 1,
    },
    update: {},
  });

  const events = [];
  for (let i = 0; i < eventCols.length; i++) {
    const { name } = eventCols[i];
    const slug = slugify(name);
    const event = await prisma.gameEvent.upsert({
      where: { slug },
      create: { name, slug, sortOrder: i },
      update: { name, sortOrder: i },
    });
    events.push({ ...event, colIndex: eventCols[i].index });
  }

  const people = await prisma.person.findMany();
  const byEmail = new Map<string, (typeof people)[number]>();
  const byName = new Map<string, (typeof people)[number]>();
  for (const p of people) {
    const e = normEmail(p.email);
    if (e && !byEmail.has(e)) byEmail.set(e, p);
    for (const k of nameKeys(p.firstName, p.lastName)) {
      if (!byName.has(k)) byName.set(k, p);
    }
  }

  let updated = 0;
  let created = 0;
  let attendanceWrites = 0;
  const log: string[] = [];

  for (const row of table.slice(1)) {
    const email = clean(row[emailIdx]);
    const firstName = clean(row[firstIdx]) ?? "";
    const lastName = clean(row[lastIdx]) ?? "";
    if (!firstName && !lastName && !email) continue;

    const phone = clean(row[phoneIdx]);
    const groupTags = normalizeGroupTags(clean(row[tagIdx]));
    const linked = clean(row[linkedIdx]);
    const tags = parseTags(groupTags);
    const cats = csvCategoryUpdate(categoriesFromTags(tags));

    const attendanceStatuses: { eventId: string; status: string }[] = [];
    for (const ev of events) {
      const status = normalizeAttendanceStatus(clean(row[ev.colIndex]));
      if (!status) continue;
      attendanceStatuses.push({ eventId: ev.id, status });
    }
    const summary = attendanceSummary(
      attendanceStatuses.map((a) => a.status),
    );

    const emailKey = normEmail(email);
    let person =
      (emailKey ? byEmail.get(emailKey) : undefined) ??
      [...nameKeys(firstName, lastName)]
        .map((k) => byName.get(k))
        .find(Boolean);

    let wasCreated = false;

    if (person) {
      const emailChanged =
        Boolean(email) && normEmail(person.email) !== emailKey;
      const nextWho =
        linked && person.whoIsThis && !person.whoIsThis.includes(linked)
          ? `${person.whoIsThis}; ${linked}`
          : linked && !person.whoIsThis
            ? linked
            : undefined;

      await prisma.person.update({
        where: { id: person.id },
        data: {
          firstName: firstName || person.firstName,
          lastName: lastName || person.lastName,
          ...(email ? { email } : {}),
          ...(phone ? { phone } : {}),
          groupTags,
          ...cats,
          attended: summary.attended,
          previousPlayer: summary.previousPlayer || person.previousPlayer,
          ...(nextWho ? { whoIsThis: nextWho } : {}),
          lastEditedBy: "AddressBook import",
        },
      });
      if (emailChanged) {
        log.push(
          `email update: ${person.firstName} ${person.lastName}: ${person.email} → ${email}`,
        );
      }
      updated += 1;
      person = {
        ...person,
        firstName: firstName || person.firstName,
        lastName: lastName || person.lastName,
        email: email ?? person.email,
      };
    } else {
      person = await prisma.person.create({
        data: {
          firstName: firstName || "Unknown",
          lastName,
          email,
          phone,
          groupTags,
          whoIsThis: linked,
          ...cats,
          attended: summary.attended,
          previousPlayer: summary.previousPlayer,
          lastEditedBy: "AddressBook import",
        },
      });
      wasCreated = true;
      created += 1;
      log.push(`created: ${firstName} ${lastName} <${email ?? "no email"}>`);
    }

    if (emailKey) byEmail.set(emailKey, person);
    for (const k of nameKeys(person.firstName, person.lastName)) {
      byName.set(k, person);
    }

    for (const a of attendanceStatuses) {
      await prisma.eventAttendance.upsert({
        where: {
          personId_eventId: { personId: person.id, eventId: a.eventId },
        },
        create: {
          personId: person.id,
          eventId: a.eventId,
          status: a.status,
        },
        update: { status: a.status },
      });
      attendanceWrites += 1;
    }

    const wantsLA =
      tags.includes("LA Mafia") || tags.includes("Los Angeles");
    const wantsVegas = tags.includes("Vegas Mafia");

    if (wantsLA || (wasCreated && !wantsVegas)) {
      await ensureMembership(person.id, la.id, { onQuickList: true });
    }
    if (wantsVegas) {
      await ensureMembership(person.id, vegas.id, { onVegas: true });
    }
  }

  console.log(`Reconciled ${csvPath}`);
  console.log(`  updated: ${updated}`);
  console.log(`  created: ${created}`);
  console.log(`  attendance upserts: ${attendanceWrites}`);
  console.log(`  events: ${events.map((e) => e.name).join(" | ")}`);
  if (log.length) {
    console.log("  notes:");
    for (const line of log) console.log(`   - ${line}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
