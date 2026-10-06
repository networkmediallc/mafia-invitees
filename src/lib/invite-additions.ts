import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";

function newId() {
  return `c${Date.now().toString(36)}${randomBytes(10).toString("hex")}`;
}

export type PendingInviteAddition = {
  id: string;
  personId: string;
  listId: string;
  addedBy: string;
  createdAt: string;
  firstName: string;
  lastName: string;
  listName: string;
  eventDate: string | null;
  listKind: string;
};

/** Persist that these people were newly added to an event list. */
export async function recordEventInviteAdditions(
  personIds: string[],
  listId: string,
  addedBy: string,
) {
  if (!personIds.length) return;
  const now = new Date().toISOString();
  for (const personId of personIds) {
    await prisma.$executeRaw`
      INSERT INTO "EventInviteAddition" ("id", "personId", "listId", "addedBy", "createdAt", "digestedAt")
      VALUES (${newId()}, ${personId}, ${listId}, ${addedBy}, ${now}, NULL)
    `;
  }
}

export async function listUndigestedInviteAdditions(): Promise<
  PendingInviteAddition[]
> {
  return prisma.$queryRaw<PendingInviteAddition[]>`
    SELECT
      a."id" as id,
      a."personId" as personId,
      a."listId" as listId,
      a."addedBy" as addedBy,
      a."createdAt" as createdAt,
      p."firstName" as firstName,
      p."lastName" as lastName,
      g."name" as listName,
      g."eventDate" as eventDate,
      g."kind" as listKind
    FROM "EventInviteAddition" a
    JOIN "Person" p ON p."id" = a."personId"
    JOIN "GuestList" g ON g."id" = a."listId"
    WHERE a."digestedAt" IS NULL
    ORDER BY a."createdAt" ASC
  `;
}

export async function markInviteAdditionsDigested(ids: string[]) {
  if (!ids.length) return;
  const now = new Date().toISOString();
  // SQLite: update in a loop to keep bindings simple
  for (const id of ids) {
    await prisma.$executeRaw`
      UPDATE "EventInviteAddition"
      SET "digestedAt" = ${now}
      WHERE "id" = ${id}
    `;
  }
}
