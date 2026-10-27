import { pathToFileURL } from "node:url";
import path from "node:path";
async function main() {
  if (!process.env.E2E_DATABASE_URL) {
    const { PGlite } = await import("@electric-sql/pglite");
    const { PGLiteSocketServer } = await import("@electric-sql/pglite-socket");
    const engine = await PGlite.create();
    const server = new PGLiteSocketServer({
      db: engine,
      host: "127.0.0.1",
      port: 5438,
      maxConnections: 4,
    });
    await server.start();
    process.env.E2E_DATABASE_URL =
      "postgresql://postgres:postgres@127.0.0.1:5438/postgres";
  }
  Object.assign(process.env, {
    DATABASE_URL: process.env.E2E_DATABASE_URL,
    STORAGE_DRIVER: "local",
    UPLOAD_DIR: path.resolve("data/e2e/uploads"),
    AUTH_MODE: "development",
    DEV_USER_ID: "alex",
    APP_ORIGIN: "http://localhost:3012",
    NEXT_TELEMETRY_DISABLED: "1",
    NEXT_DIST_DIR: ".next-e2e",
  });
  if (!process.env.E2E_DATABASE_URL)
    throw new Error(
      "Set E2E_DATABASE_URL to an isolated PostgreSQL test database",
    );
  const { closeDatabase } = await import("../lib/db");
  const { migrate } = await import("../lib/db/migrate");
  const { seed } = await import("../lib/db/seed");
  await migrate();
  await seed();
  await closeDatabase();
  const entry = path.resolve("node_modules/next/dist/bin/next");
  process.argv = [
    process.execPath,
    entry,
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3012",
  ];
  await import(pathToFileURL(entry).href);
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
