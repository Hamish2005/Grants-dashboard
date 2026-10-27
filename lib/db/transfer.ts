import { getTableColumns, getTableName, sql } from "drizzle-orm";
import { db, transaction } from "./index";
import * as schema from "./schema";

export const transferTables = [
  schema.users,
  schema.programs,
  schema.cycles,
  schema.templates,
  schema.templateStages,
  schema.grants,
  schema.stages,
  schema.comments,
  schema.documents,
  schema.auditLogs,
  schema.tasks,
  schema.mappings,
];
export type Snapshot = Record<string, Record<string, unknown>[]>;

export async function restoreSnapshot(snapshot: Snapshot) {
  await transaction(async () => {
    // Never merge or overwrite a previously provisioned database.
    for (const table of transferTables) {
      if ((await db.select().from(table).limit(1)).length)
        throw new Error(
          "Migration destination must be empty; existing records were not changed",
        );
    }
    for (const table of transferTables) {
      const name = getTableName(table);
      const columns = getTableColumns(table);
      const rows = snapshot[name];
      if (!rows) throw new Error(`Missing source table: ${name}`);
      for (const row of rows) {
        const fields = Object.entries(columns).filter(([key]) => key in row);
        const values = fields.map(([key, column]) => {
          const raw = row[key];
          if (column.dataType === "boolean" && raw !== null) {
            if (raw !== 0 && raw !== 1 && typeof raw !== "boolean")
              throw new Error("Invalid source boolean");
            return sql`${Boolean(raw)}`;
          }
          if (
            column.dataType === "number" &&
            raw !== null &&
            !Number.isSafeInteger(raw)
          )
            throw new Error("Invalid source integer");
          return sql`${raw}`;
        });
        await db.execute(
          sql`INSERT INTO ${sql.identifier(name)} (${sql.join(
            fields.map(([, c]) => sql.identifier(c.name)),
            sql`, `,
          )}) VALUES (${sql.join(values, sql`, `)})`,
        );
      }
      const count = await db.execute(
        sql`SELECT count(*)::integer AS count FROM ${sql.identifier(name)}`,
      );
      if (count.rows[0].count !== rows.length)
        throw new Error(`Row count mismatch: ${name}`);
    }
  });
}
