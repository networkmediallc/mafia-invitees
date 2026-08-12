-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL DEFAULT '',
    "email" TEXT,
    "phone" TEXT,
    "title" TEXT,
    "plusOnes" TEXT,
    "notes" TEXT,
    "whoIsThis" TEXT,
    "attended" TEXT,
    "previousPlayer" BOOLEAN NOT NULL DEFAULT false,
    "sent" TEXT,
    "journalist" BOOLEAN NOT NULL DEFAULT false,
    "outOfTown" BOOLEAN NOT NULL DEFAULT false,
    "fourSeasons" BOOLEAN NOT NULL DEFAULT false,
    "magician" BOOLEAN NOT NULL DEFAULT false,
    "nmCreatorInLA" BOOLEAN NOT NULL DEFAULT false,
    "game" BOOLEAN NOT NULL DEFAULT false,
    "staffFamily" BOOLEAN NOT NULL DEFAULT false,
    "mi" BOOLEAN NOT NULL DEFAULT false,
    "industry" BOOLEAN NOT NULL DEFAULT false,
    "rando" BOOLEAN NOT NULL DEFAULT false,
    "onQuickList" BOOLEAN NOT NULL DEFAULT false,
    "quickRank" INTEGER,
    "onVegas" BOOLEAN NOT NULL DEFAULT false,
    "vegasRank" INTEGER,
    "onFormer" BOOLEAN NOT NULL DEFAULT false,
    "formerRank" INTEGER,
    "event1Rsvp" TEXT,
    "event2Rsvp" TEXT,
    "event3Rsvp" TEXT,
    "lastEditedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AppMeta" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "Person_onQuickList_quickRank_idx" ON "Person"("onQuickList", "quickRank");

-- CreateIndex
CREATE INDEX "Person_onVegas_vegasRank_idx" ON "Person"("onVegas", "vegasRank");

-- CreateIndex
CREATE INDEX "Person_onFormer_formerRank_idx" ON "Person"("onFormer", "formerRank");

-- CreateIndex
CREATE INDEX "Person_email_idx" ON "Person"("email");
