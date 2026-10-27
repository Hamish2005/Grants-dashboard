import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { BlobsServer } from "@netlify/blobs/server";
import { setEnvironmentContext } from "@netlify/blobs";
import {
  putFile,
  readStoredFile,
  deleteFile,
  storedFiles,
} from "../lib/storage";

test("private Netlify Blobs writes survive new clients and reject overwrites", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "grants-blobs-test-"));
  const server = new BlobsServer({ directory, token: "test-token" });
  try {
    const { port } = await server.start();
    setEnvironmentContext({
      siteID: "test-site",
      token: "test-token",
      edgeURL: `http://127.0.0.1:${port}`,
      uncachedEdgeURL: `http://127.0.0.1:${port}`,
    });
    process.env.STORAGE_DRIVER = "netlify";
    process.env.BLOB_STORE_NAME = "grants-test";
    const name = randomUUID() + ".csv";
    const bytes = Buffer.from("Grant name\nTest data");
    await putFile(name, bytes);
    assert.deepEqual(await readStoredFile(name), bytes);
    await assert.rejects(() => putFile(name, "overwrite"));
    assert.deepEqual(await readStoredFile(name), bytes);
    const files = [];
    for await (const entry of storedFiles()) files.push(entry);
    assert.equal(files[0].name, name);
    assert.ok(files[0].createdAt > 0);
    process.env.BLOB_STORE_NAME = "separate-preview-store";
    await assert.rejects(() => readStoredFile(name), /not found/);
    process.env.BLOB_STORE_NAME = "grants-test";
    await deleteFile(name);
    await assert.rejects(() => readStoredFile(name), /not found/);
    await assert.rejects(
      () => readStoredFile("../private.csv"),
      /Invalid storage key/,
    );
    Object.assign(process.env, {
      NODE_ENV: "production",
      STORAGE_DRIVER: "local",
    });
    await assert.rejects(() => putFile(name, bytes), /disabled in production/);
  } finally {
    await server.stop();
    assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
    await rm(directory, { recursive: true, force: true });
  }
});
