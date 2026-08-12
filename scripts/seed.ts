import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

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

type Draft = {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  plusOnes: string | null;
  notes: string | null;
  whoIsThis: string | null;
  attended: string | null;
  previousPlayer: boolean;
  sent: string | null;
  journalist: boolean;
  outOfTown: boolean;
  fourSeasons: boolean;
  magician: boolean;
  magic: boolean;
  nmCreatorInLA: boolean;
  game: boolean;
  staffFamily: boolean;
  mi: boolean;
  industry: boolean;
  rando: boolean;
  formerPlayer: boolean;
  onQuickList: boolean;
  quickRank: number | null;
  onVegas: boolean;
  vegasRank: number | null;
  onFormer: boolean;
  formerRank: number | null;
  archived: boolean;
  archivedAt: string | null;
  event1Rsvp: string | null;
  event2Rsvp: string | null;
  event3Rsvp: string | null;
};

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
  const v = (value ?? "").trim();
  return v || null;
}

function isMarked(value: string | undefined | null) {
  const v = (value ?? "").trim().toLowerCase();
  return v === "x" || v === "yes" || v === "true" || v === "1";
}

function normName(first: string, last: string) {
  return `${first.trim().toLowerCase()}|${last.trim().toLowerCase()}`;
}

function normEmail(email: string | null) {
  return email?.trim().toLowerCase() || null;
}

function emptyDraft(partial: Partial<Draft> & { firstName: string }): Draft {
  return {
    firstName: partial.firstName.trim(),
    lastName: (partial.lastName ?? "").trim(),
    email: partial.email ?? null,
    phone: partial.phone ?? null,
    title: partial.title ?? null,
    plusOnes: partial.plusOnes ?? null,
    notes: partial.notes ?? null,
    whoIsThis: partial.whoIsThis ?? null,
    attended: partial.attended ?? null,
    previousPlayer: partial.previousPlayer ?? false,
    sent: partial.sent ?? null,
    journalist: partial.journalist ?? false,
    outOfTown: partial.outOfTown ?? false,
    fourSeasons: partial.fourSeasons ?? false,
    magician: partial.magician ?? false,
    magic: partial.magic ?? partial.magician ?? false,
    nmCreatorInLA: partial.nmCreatorInLA ?? false,
    game: partial.game ?? false,
    staffFamily: partial.staffFamily ?? false,
    mi: partial.mi ?? false,
    industry: partial.industry ?? false,
    rando: partial.rando ?? false,
    formerPlayer: partial.formerPlayer ?? false,
    onQuickList: partial.onQuickList ?? false,
    quickRank: partial.quickRank ?? null,
    onVegas: partial.onVegas ?? false,
    vegasRank: partial.vegasRank ?? null,
    onFormer: partial.onFormer ?? false,
    formerRank: partial.formerRank ?? null,
    archived: partial.archived ?? false,
    archivedAt: partial.archivedAt ?? null,
    event1Rsvp: partial.event1Rsvp ?? null,
    event2Rsvp: partial.event2Rsvp ?? null,
    event3Rsvp: partial.event3Rsvp ?? null,
  };
}

function merge(into: Draft, from: Draft): Draft {
  const pick = <T>(a: T, b: T) =>
    a === null || a === undefined || a === "" || a === false ? b : a;

  return {
    firstName: into.firstName || from.firstName,
    lastName: into.lastName || from.lastName,
    email: pick(into.email, from.email),
    phone: pick(into.phone, from.phone),
    title: pick(into.title, from.title),
    plusOnes: pick(into.plusOnes, from.plusOnes),
    notes: pick(into.notes, from.notes),
    whoIsThis: pick(into.whoIsThis, from.whoIsThis),
    attended: pick(into.attended, from.attended),
    previousPlayer: into.previousPlayer || from.previousPlayer,
    sent: pick(into.sent, from.sent),
    journalist: into.journalist || from.journalist,
    outOfTown: into.outOfTown || from.outOfTown,
    fourSeasons: into.fourSeasons || from.fourSeasons,
    magician: into.magician || from.magician,
    magic: into.magic || from.magic || into.magician || from.magician,
    nmCreatorInLA: into.nmCreatorInLA || from.nmCreatorInLA,
    game: into.game || from.game,
    staffFamily: into.staffFamily || from.staffFamily,
    mi: into.mi || from.mi,
    industry: into.industry || from.industry,
    rando: into.rando || from.rando,
    formerPlayer: into.formerPlayer || from.formerPlayer,
    onQuickList: into.onQuickList || from.onQuickList,
    quickRank: into.quickRank ?? from.quickRank,
    onVegas: into.onVegas || from.onVegas,
    vegasRank: into.vegasRank ?? from.vegasRank,
    onFormer: into.onFormer || from.onFormer,
    formerRank: into.formerRank ?? from.formerRank,
    archived: into.archived || from.archived,
    archivedAt: pick(into.archivedAt, from.archivedAt),
    event1Rsvp: pick(into.event1Rsvp, from.event1Rsvp),
    event2Rsvp: pick(into.event2Rsvp, from.event2Rsvp),
    event3Rsvp: pick(into.event3Rsvp, from.event3Rsvp),
  };
}

function upsertMap(
  map: Map<string, Draft>,
  draft: Draft,
  keyHint?: string | null,
) {
  const emailKey = normEmail(draft.email);
  const nameKey = normName(draft.firstName, draft.lastName);
  const key = keyHint || emailKey || nameKey;

  // Prefer matching existing by email, then exact name
  let existingKey: string | undefined;
  if (emailKey) {
    for (const [k, v] of map) {
      if (normEmail(v.email) === emailKey) {
        existingKey = k;
        break;
      }
    }
  }
  if (!existingKey) {
    for (const [k, v] of map) {
      if (normName(v.firstName, v.lastName) === nameKey) {
        existingKey = k;
        break;
      }
    }
  }

  if (existingKey) {
    map.set(existingKey, merge(map.get(existingKey)!, draft));
  } else {
    map.set(key, draft);
  }
}

function loadCsv(relative: string) {
  const file = path.join(process.cwd(), "data", "import", relative);
  return parseCsv(readFileSync(file, "utf8"));
}

async function main() {
  const people = new Map<string, Draft>();

  // Quick List — ranking order is row order
  {
    const rows = loadCsv("quick-list.csv");
    const [, ...body] = rows;
    let rank = 1;
    for (const r of body) {
      const firstName = clean(r[0]);
      if (!firstName) continue;
      upsertMap(
        people,
        emptyDraft({
          firstName,
          lastName: clean(r[1]) ?? "",
          plusOnes: clean(r[2]),
          email: clean(r[3]),
          phone: clean(r[4]),
          title: clean(r[5]),
          journalist: isMarked(r[6]),
          outOfTown: isMarked(r[7]) || Boolean(clean(r[7])),
          fourSeasons: isMarked(r[8]),
          magician: isMarked(r[9]),
          magic: isMarked(r[9]),
          nmCreatorInLA: false,
          game: isMarked(r[11]),
          staffFamily: isMarked(r[12]),
          mi: isMarked(r[13]),
          industry: isMarked(r[14]),
          rando: isMarked(r[15]),
          notes: clean(r[16]),
          attended: clean(r[17]),
          previousPlayer: isMarked(r[18]),
          sent: clean(r[19]),
          whoIsThis: clean(r[20]),
          onQuickList: true,
          quickRank: rank++,
        }),
      );
    }
  }

  // Vegas Players — no header row in export
  {
    const rows = loadCsv("vegas.csv");
    let rank = 1;
    for (const r of rows) {
      const firstName = clean(r[0]);
      if (!firstName) continue;
      upsertMap(
        people,
        emptyDraft({
          firstName,
          lastName: clean(r[1]) ?? "",
          plusOnes: clean(r[2]),
          email: clean(r[3]),
          phone: clean(r[4]),
          attended: clean(r[14]) ?? clean(r[r.length - 1]),
          onVegas: true,
          vegasRank: rank++,
        }),
      );
    }
  }

  // Former Players → Archived + Former Player tag
  {
    const rows = loadCsv("former.csv");
    const [, ...body] = rows;
    const archivedAt = (() => {
      const d = new Date();
      return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
    })();
    for (const r of body) {
      const firstName = clean(r[0]);
      if (!firstName) continue;
      upsertMap(
        people,
        emptyDraft({
          firstName,
          lastName: clean(r[1]) ?? "",
          attended: clean(r[2]),
          plusOnes: clean(r[3]),
          email: clean(r[4]),
          phone: clean(r[5]),
          previousPlayer: isMarked(r[6]) || true,
          whoIsThis: clean(r[7]) || clean(r[15]),
          formerPlayer: true,
          archived: true,
          archivedAt,
        }),
      );
    }
  }

  // Full info / RSVP — skip section headers like "NEVER A YES"
  {
    const rows = loadCsv("full-info.csv");
    const [, ...body] = rows;
    for (const r of body) {
      const firstName = clean(r[0]);
      const lastName = clean(r[1]);
      if (!firstName) continue;
      if (!lastName && !clean(r[6])) continue;
      if (firstName.toUpperCase().includes("NEVER")) continue;

      upsertMap(
        people,
        emptyDraft({
          firstName,
          lastName: lastName ?? "",
          event1Rsvp: clean(r[2]),
          event2Rsvp: clean(r[3]),
          event3Rsvp: clean(r[4]),
          plusOnes: clean(r[5]),
          email: clean(r[6]),
          phone: clean(r[7]),
        }),
      );
    }
  }

  await prisma.person.deleteMany();
  await prisma.appMeta.deleteMany({ where: { key: "lists_backfilled" } });
  const list = [...people.values()];
  for (const person of list) {
    await prisma.person.create({ data: person });
  }

  await prisma.appMeta.upsert({
    where: { key: "importedAt" },
    update: { value: new Date().toISOString() },
    create: { key: "importedAt", value: new Date().toISOString() },
  });

  console.log(`Imported ${list.length} people`);
  console.log(
    `  LA/Quick: ${list.filter((p) => p.onQuickList).length}, Vegas: ${list.filter((p) => p.onVegas).length}, Archived: ${list.filter((p) => p.archived).length}, Former Player tag: ${list.filter((p) => p.formerPlayer).length}`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
