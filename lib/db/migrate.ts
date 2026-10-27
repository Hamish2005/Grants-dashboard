import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { sql } from "drizzle-orm";
import { db, transaction } from "./index";

export async function migrate() {
  await transaction(async () => {
    await db.execute(
      sql`CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, "appliedAt" TEXT NOT NULL)`,
    );
    const directory = path.join(process.cwd(), "migrations/postgres");
    for (const name of (await readdir(directory))
      .filter((n) => /^\d+_.+\.sql$/.test(n))
      .sort()) {
      const existing = await db.execute(
        sql`SELECT name FROM schema_migrations WHERE name = ${name}`,
      );
      if (existing.rows.length) continue;
      for (const statement of (
        await readFile(path.join(directory, name), "utf8")
      ).split("--> statement-breakpoint")) {
        if (statement.trim()) await db.execute(sql.raw(statement));
      }
      await db.execute(
        sql`INSERT INTO schema_migrations VALUES (${name}, ${new Date().toISOString()})`,
      );
    }
  });
}
