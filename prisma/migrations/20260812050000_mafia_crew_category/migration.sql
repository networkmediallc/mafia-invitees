-- AlterTable
ALTER TABLE "Person" ADD COLUMN "mafiaCrew" BOOLEAN NOT NULL DEFAULT false;

-- Clear removed Mafia category
UPDATE "Person" SET "mafia" = 0;
