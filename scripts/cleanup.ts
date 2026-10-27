import { db, closeDatabase, transaction } from "../lib/db";
import { documents } from "../lib/db/schema";
import { storedFiles, readStoredFile, deleteFile } from "../lib/storage";
async function main() {
  let removed = 0;
  try {
    for await (const { name, createdAt } of storedFiles()) {
      if (Date.now() - createdAt < 24 * 60 * 60 * 1000) continue;
      await transaction(async () => {
        const referenced = new Set(
          (await db.select().from(documents)).map((d) => d.path),
        );
        if (referenced.has(name)) return;
        if (name.endsWith(".json")) {
          const preview = JSON.parse(
            (await readStoredFile(name)).toString("utf8"),
          );
          if (Date.now() - preview.createdAt < 24 * 60 * 60 * 1000) return;
        }
        await deleteFile(name);
        removed++;
      });
    }
    console.log(`Removed ${removed} expired, unreferenced objects.`);
  } finally {
    await closeDatabase();
  }
}
main().catch(() => {
  console.error(
    "Storage cleanup failed; check database and storage configuration.",
  );
  process.exitCode = 1;
});
