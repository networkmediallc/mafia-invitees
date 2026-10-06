-- CreateTable
CREATE TABLE "EventInviteAddition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "personId" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "addedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "digestedAt" DATETIME,
    CONSTRAINT "EventInviteAddition_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EventInviteAddition_listId_fkey" FOREIGN KEY ("listId") REFERENCES "GuestList" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "EventInviteAddition_digestedAt_createdAt_idx" ON "EventInviteAddition"("digestedAt", "createdAt");

-- CreateIndex
CREATE INDEX "EventInviteAddition_listId_idx" ON "EventInviteAddition"("listId");

-- CreateIndex
CREATE INDEX "EventInviteAddition_personId_idx" ON "EventInviteAddition"("personId");
