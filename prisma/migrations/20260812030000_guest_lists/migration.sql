-- CreateTable
CREATE TABLE "GuestList" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'ranked',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ListMembership" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "personId" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "rank" INTEGER,
    CONSTRAINT "ListMembership_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ListMembership_listId_fkey" FOREIGN KEY ("listId") REFERENCES "GuestList" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "GuestList_slug_key" ON "GuestList"("slug");

-- CreateIndex
CREATE INDEX "ListMembership_listId_rank_idx" ON "ListMembership"("listId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "ListMembership_personId_listId_key" ON "ListMembership"("personId", "listId");
