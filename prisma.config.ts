import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

function resolveDatabaseUrl() {
  const fromEnv = process.env.DATABASE_URL?.trim();
  if (fromEnv && !fromEnv.includes("/tmp/build.db")) {
    if (fromEnv.startsWith("file:") && !fromEnv.startsWith("file:/")) {
      // Resolve relative file: URLs against prisma/ (Prisma's usual convention)
      const rel = fromEnv.slice("file:".length);
      return `file:${path.resolve(process.cwd(), "prisma", rel)}`;
    }
    return fromEnv;
  }

  const volume = process.env.RAILWAY_VOLUME_MOUNT_PATH?.trim();
  if (volume) {
    return `file:${path.join(volume, "mafia.db")}`;
  }

  return fromEnv || "file:../data/mafia.db";
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: resolveDatabaseUrl(),
  },
});
