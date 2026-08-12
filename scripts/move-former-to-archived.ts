import "dotenv/config";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

function resolveDatabaseUrl() {
  const raw = process.env.DATABASE_URL ?? "file:../data/mafia.db";
  if (!raw.startsWith("file:")) return raw;
  const filePath = raw.slice("file:".length);
  if (path.isAbsolute(filePath)) return raw;
  return `file:${path.resolve(process.cwd(), "prisma", filePath)}`;
}

const adapter = new PrismaBetterSqlite3({ url: resolveDatabaseUrl() });
const prisma = new PrismaClient({ adapter });

function today() {
  const d = new Date();
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

async function main() {
  const result = await prisma.person.updateMany({
    where: { onFormer: true },
    data: {
      archived: true,
      archivedAt: today(),
      formerPlayer: true,
      onFormer: false,
      formerRank: null,
    },
  });
  console.log(`Moved ${result.count} former players to Archived with Former Player tag`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
