import { readdir, readFile, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { db, sqlite } from "../lib/db";
import { documents } from "../lib/db/schema";
import { uploadRoot } from "../lib/imports";
async function main() {
  const root = uploadRoot();
  const referenced = new Set(
    db
      .select()
      .from(documents)
      .all()
      .map((d) => d.path)
      .filter(Boolean),
  );
  let removed = 0;
  for (const name of await readdir(root).catch(() => [] as string[])) {
    // Only generated filenames in the exact configured upload directory qualify.
    if (
      !/^[0-9a-f-]{36}\.(json|pdf|docx|xlsx|csv)$/.test(name) ||
      referenced.has(name)
    )
      continue;
    const location = path.resolve(root, name);
    if (path.dirname(location) !== root) throw new Error("Unsafe cleanup path");
    const info = await stat(location);
    if (Date.now() - info.mtimeMs < 24 * 60 * 60 * 1000) continue;
    if (name.endsWith(".json")) {
      const preview = JSON.parse(await readFile(location, "utf8"));
      if (Date.now() - preview.createdAt < 24 * 60 * 60 * 1000) continue;
    }
    await unlink(location);
    removed++;
  }
  sqlite.close();
  console.log(`Removed ${removed} expired, unreferenced upload files.`);
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
