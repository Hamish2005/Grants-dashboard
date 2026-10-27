import { AsyncLocalStorage } from "node:async_hooks";
import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import * as schema from "./schema";

type Database = NodePgDatabase<typeof schema>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
let pool: Pool | undefined;
let database: Database | undefined;
const context = new AsyncLocalStorage<Transaction>();

function connection(): Database {
  if (database) return database;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString)
    throw new Error(
      "Database is not configured. Set DATABASE_URL to your PostgreSQL connection string.",
    );
  pool = new Pool({
    connectionString,
    max: 3,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
    allowExitOnIdle: true,
  });
  pool.on("error", () =>
    console.error(
      "Idle PostgreSQL connection failed; the pool will reconnect.",
    ),
  );
  database = drizzle(pool, { schema });
  return database;
}

// Imports and builds never create files or open a database. Nested services
// automatically share the transaction connection, including its savepoints.
export const db = new Proxy({} as Database, {
  get(_target, property) {
    const active = context.getStore() || connection();
    const value = Reflect.get(active, property);
    return typeof value === "function" ? value.bind(active) : value;
  },
});

export async function transaction<T>(work: () => Promise<T>): Promise<T> {
  const parent = context.getStore();
  if (parent) return parent.transaction((tx) => context.run(tx, work));
  return connection().transaction(async (tx) => {
    // Serialize workspace mutations across function instances. Reads remain
    // concurrent; nested operations roll back independently with savepoints.
    await tx.execute(sql`select pg_advisory_xact_lock(72413019)`);
    return context.run(tx, work);
  });
}

export async function closeDatabase() {
  await pool?.end();
  pool = undefined;
  database = undefined;
}

export function useTestDatabase(value: Database) {
  if (process.env.NODE_ENV !== "test")
    throw new Error("Test database injection is disabled");
  database = value;
}
