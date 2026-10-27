import Database from "better-sqlite3";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getTableName } from "drizzle-orm";
import { closeDatabase } from "../lib/db";
import { migrate } from "../lib/db/migrate";
import {
  restoreSnapshot,
  transferTables,
  type Snapshot,
} from "../lib/db/transfer";
import { putFile, readStoredFile } from "../lib/storage";

async function main() {
  const sourcePath = process.env.SQLITE_SOURCE_PATH;
  const sourceUploads = process.env.SQLITE_SOURCE_UPLOADS;
  if (!sourcePath || !sourceUploads)
    throw new Error(
      "Set SQLITE_SOURCE_PATH and SQLITE_SOURCE_UPLOADS to a stopped application's backup",
    );
  const source = new Database(path.resolve(sourcePath), {
    readonly: true,
    fileMustExist: true,
  });
  try {
    const snapshot = source.transaction(
      () =>
        Object.fromEntries(
          transferTables.map((table) => {
            const name = getTableName(table);
            return [name, source.prepare(`SELECT * FROM "${name}"`).all()];
          }),
        ) as Snapshot,
    )();
    const files = [
      ...new Set(
        snapshot.documents
          .map((d) => d.path)
          .filter((p): p is string => typeof p === "string"),
      ),
    ];
    for (const name of files) {
      if (!/^[0-9a-f-]{36}\.(pdf|docx|xlsx|csv)$/.test(name))
        throw new Error("Unsafe legacy upload path");
      const bytes = await readFile(
        path.join(path.resolve(sourceUploads), name),
      );
      if (process.argv.includes("--apply")) {
        // Retry safely after a failed SQL transaction: identical files are OK.
        try {
          await putFile(name, bytes);
        } catch (error) {
          const existing = await readStoredFile(name).catch(() => null);
          if (!existing?.equals(bytes)) throw error;
        }
      }
    }
    console.log(
      JSON.stringify({
        tables: Object.fromEntries(
          Object.entries(snapshot).map(([k, v]) => [k, v.length]),
        ),
        files: files.length,
      }),
    );
    if (!process.argv.includes("--apply")) {
      console.log(
        "Read-only inspection complete. Add --apply to copy into an empty PostgreSQL database and the configured private store.",
      );
      return;
    }
    await migrate();
    await restoreSnapshot(snapshot);
    console.log(
      "Migration committed; IDs, relationships, comments, audit history and file bytes preserved. The SQLite source was not modified.",
    );
  } finally {
    source.close();
    await closeDatabase();
  }
}
main().catch(() => {
  console.error(
    "Migration failed. Source is unchanged. Verify source files, an empty destination, and database/storage access. Copied blobs may remain for a safe retry.",
  );
  process.exitCode = 1;
});
