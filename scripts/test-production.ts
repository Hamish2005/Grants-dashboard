import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

async function main() {
  const port = 3013;
  const base = `http://127.0.0.1:${port}`;
  const server = spawn(
    process.execPath,
    [
      path.resolve("node_modules/next/dist/bin/next"),
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      windowsHide: true,
      stdio: "ignore",
      env: {
        ...process.env,
        NEXT_DIST_DIR: ".next",
        NODE_ENV: "production",
        AUTH_MODE: "entra",
        APP_ORIGIN: "https://grant-dashboard.netlify.app",
        AUTH_URL: "https://grant-dashboard.netlify.app",
        AUTH_SECRET: "production-smoke-test-only-secret-32-chars",
        ENTRA_TENANT_ID: "11111111-1111-4111-8111-111111111111",
        ENTRA_CLIENT_ID: "22222222-2222-4222-8222-222222222222",
        ENTRA_CLIENT_SECRET: "production-smoke-test-placeholder",
        DATABASE_URL:
          "postgresql://unconfigured:unconfigured@127.0.0.1:1/missing",
        STORAGE_DRIVER: "netlify",
        BLOB_STORE_NAME: "smoke-test-unused",
      },
    },
  );
  try {
    let ready = false;
    for (let i = 0; i < 60; i++) {
      if (server.exitCode !== null)
        throw new Error("Production test server exited");
      try {
        if ((await fetch(`${base}/login`)).ok) {
          ready = true;
          break;
        }
      } catch {}
      await delay(250);
    }
    assert.ok(ready, "production login becomes available without a database");
    const response = await fetch(base, { redirect: "manual" });
    assert.ok([303, 307, 308].includes(response.status));
    assert.ok(response.headers.get("location")?.endsWith("/login"));
    const html = await (await fetch(`${base}/login`)).text();
    assert.match(html, /Sign in with Microsoft/);
    assert.doesNotMatch(
      html,
      /production-smoke-test-placeholder|production-smoke-test-only-secret/,
    );
    for (const route of [
      "/api/data",
      "/api/documents?id=unknown",
      "/api/export",
    ]) {
      assert.equal(
        (await fetch(base + route)).status,
        401,
        `${route} requires authentication`,
      );
    }
    console.log(
      "Production smoke passed: public login, protected page redirect, private API rejection, no database needed before sign-in.",
    );
  } finally {
    server.kill();
    await new Promise<void>((resolve) => {
      if (server.exitCode !== null) resolve();
      else server.once("exit", () => resolve());
    });
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
