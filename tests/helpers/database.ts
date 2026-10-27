import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { useTestDatabase } from "../../lib/db";
import * as schema from "../../lib/db/schema";

export async function testDatabase() {
  Object.assign(process.env, { NODE_ENV: "test" });
  const engine = new PGlite();
  // Both Drizzle drivers implement the PostgreSQL query/transaction interface.
  useTestDatabase(
    drizzle(engine, { schema }) as unknown as NodePgDatabase<typeof schema>,
  );
  return engine;
}
