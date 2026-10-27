import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import * as schema from "./schema";
const location = path.resolve(
  /* turbopackIgnore: true */
  process.env.DATABASE_PATH || "./data/grants.sqlite",
);
mkdirSync(path.dirname(location), { recursive: true });
export const sqlite = new Database(location);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("busy_timeout = 5000");
export const db = drizzle(sqlite, { schema });
export function migrate() {
  sqlite.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, appliedAt TEXT NOT NULL)",
  );
  const directory = path.join(process.cwd(), "migrations");
  for (const name of readdirSync(directory)
    .filter((n) => /^\d+_.+\.sql$/.test(n))
    .sort()) {
    if (
      sqlite
        .prepare("SELECT name FROM schema_migrations WHERE name = ?")
        .get(name)
    )
      continue;
    sqlite.transaction(() => {
      sqlite.exec(readFileSync(path.join(directory, name), "utf8"));
      sqlite
        .prepare("INSERT INTO schema_migrations VALUES (?, ?)")
        .run(name, new Date().toISOString());
    })();
  }
}
