import path from "node:path";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";

/** Bump when GuestList / Person fields change so the hot-reload singleton is replaced. */
const PRISMA_SCHEMA_VERSION = 6;

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaSchemaVersion?: number;
};

function resolveSqliteFileUrl() {
  const volume = process.env.RAILWAY_VOLUME_MOUNT_PATH?.trim();
  if (volume) {
    return `file:${path.join(volume, "mafia.db")}`;
  }

  const raw = process.env.DATABASE_URL?.trim() || "file:../data/mafia.db";
  if (!raw.startsWith("file:")) return raw;
  const filePath = raw.slice("file:".length);
  if (path.isAbsolute(filePath)) return raw;
  const absolute = path.resolve(process.cwd(), "prisma", filePath);
  return `file:${absolute}`;
}

function createClient() {
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
  const tursoToken = process.env.TURSO_AUTH_TOKEN?.trim();

  if (tursoUrl) {
    const adapter = new PrismaLibSql({
      url: tursoUrl,
      authToken: tursoToken,
    });
    return new PrismaClient({ adapter });
  }

  const adapter = new PrismaBetterSqlite3({ url: resolveSqliteFileUrl() });
  return new PrismaClient({ adapter });
}

function getClient() {
  if (
    globalForPrisma.prisma &&
    globalForPrisma.prismaSchemaVersion === PRISMA_SCHEMA_VERSION
  ) {
    return globalForPrisma.prisma;
  }
  const client = createClient();
  globalForPrisma.prisma = client;
  globalForPrisma.prismaSchemaVersion = PRISMA_SCHEMA_VERSION;
  return client;
}

/** Lazy proxy so importing this module during `next build` does not open the DB. */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, _receiver) {
    const client = getClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
