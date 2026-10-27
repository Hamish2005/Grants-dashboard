import { getStore } from "@netlify/blobs";
import {
  mkdir,
  readFile,
  writeFile,
  unlink,
  readdir,
  stat,
} from "node:fs/promises";
import path from "node:path";

export const uploadRoot = () =>
  path.resolve(
    /* turbopackIgnore: true */ process.env.UPLOAD_DIR || "./data/uploads",
  );
function local() {
  if (process.env.STORAGE_DRIVER !== "local") return false;
  if (process.env.NODE_ENV === "production")
    throw new Error("Local upload storage is disabled in production");
  return true;
}
function key(value: string) {
  if (!/^[0-9a-f-]{36}\.(json|pdf|docx|xlsx|csv)$/.test(value))
    throw new Error("Invalid storage key");
  return value;
}
function store() {
  const name = process.env.BLOB_STORE_NAME;
  if (!name)
    throw new Error("Private storage is not configured. Set BLOB_STORE_NAME.");
  return getStore({
    name,
    consistency: "strong",
    ...(process.env.NETLIFY_BLOBS_TOKEN
      ? {
          siteID: process.env.NETLIFY_SITE_ID,
          token: process.env.NETLIFY_BLOBS_TOKEN,
        }
      : {}),
  });
}
export async function putFile(name: string, bytes: Buffer | string) {
  key(name);
  if (local()) {
    await mkdir(uploadRoot(), { recursive: true });
    await writeFile(path.join(uploadRoot(), name), bytes, {
      flag: "wx",
      mode: 0o600,
    });
    return;
  }
  const value =
    typeof bytes === "string" ? bytes : Uint8Array.from(bytes).buffer;
  const result = await store().set(name, value, {
    onlyIfNew: true,
    metadata: { createdAt: Date.now() },
  });
  if (!result.modified) throw new Error("Storage object already exists");
}
export async function readStoredFile(name: string): Promise<Buffer> {
  key(name);
  if (local()) return readFile(path.join(uploadRoot(), name));
  const value = await store().get(name, { type: "arrayBuffer" });
  if (value === null) throw new Error("Stored file not found");
  return Buffer.from(value);
}
export async function deleteFile(name: string) {
  key(name);
  if (local()) await unlink(path.join(uploadRoot(), name));
  else await store().delete(name);
}
export async function* storedFiles(): AsyncGenerator<{
  name: string;
  createdAt: number;
}> {
  if (local()) {
    for (const name of await readdir(uploadRoot()).catch(
      () => [] as string[],
    )) {
      if (!/^[0-9a-f-]{36}\.(json|pdf|docx|xlsx|csv)$/.test(name)) continue;
      yield {
        name,
        createdAt: (await stat(path.join(uploadRoot(), name))).mtimeMs,
      };
    }
  } else {
    const storage = store();
    for await (const page of storage.list({ paginate: true })) {
      for (const blob of page.blobs) {
        if (!/^[0-9a-f-]{36}\.(json|pdf|docx|xlsx|csv)$/.test(blob.key))
          continue;
        const info = await storage.getMetadata(blob.key);
        const createdAt = Number(info?.metadata.createdAt);
        if (Number.isFinite(createdAt) && createdAt > 0)
          yield { name: blob.key, createdAt };
      }
    }
  }
}
