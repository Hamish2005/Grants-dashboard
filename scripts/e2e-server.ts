import { pathToFileURL } from "node:url";
import path from "node:path";
async function main() {
  Object.assign(process.env, {
    DATABASE_PATH: path.resolve("data/e2e/grants.sqlite"),
    UPLOAD_DIR: path.resolve("data/e2e/uploads"),
    AUTH_MODE: "development",
    DEV_USER_ID: "alex",
    APP_ORIGIN: "http://localhost:3012",
    NEXT_TELEMETRY_DISABLED: "1",
  });
  const { migrate, sqlite } = await import("../lib/db");
  const { seed } = await import("../lib/db/seed");
  migrate();
  seed();
  sqlite.close();
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
