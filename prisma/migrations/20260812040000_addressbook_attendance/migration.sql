-- AlterTable
ALTER TABLE "Person" ADD COLUMN "groupTags" TEXT;

-- CreateTable
CREATE TABLE "GameEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EventAttendance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "personId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    CONSTRAINT "EventAttendance_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EventAttendance_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "GameEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "GameEvent_slug_key" ON "GameEvent"("slug");

-- CreateIndex
CREATE INDEX "EventAttendance_eventId_status_idx" ON "EventAttendance"("eventId", "status");

-- CreateIndex
CREATE INDEX "EventAttendance_personId_idx" ON "EventAttendance"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "EventAttendance_personId_eventId_key" ON "EventAttendance"("personId", "eventId");
