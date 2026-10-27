import { test } from "node:test";
import assert from "node:assert/strict";
import { testDatabase } from "./helpers/database";
import { migrate } from "../lib/db/migrate";
import { db } from "../lib/db";
import { users } from "../lib/db/schema";
import { entraSettings, provisionedEntraUser } from "../lib/entra";

test("Entra access requires the configured tenant and a provisioned immutable staff ID", async () => {
  const engine = await testDatabase();
  const tenant = "11111111-1111-4111-8111-111111111111";
  const oid = "22222222-2222-4222-8222-222222222222";
  try {
    Object.assign(process.env, {
      AUTH_MODE: "entra",
      ENTRA_TENANT_ID: tenant,
      ENTRA_CLIENT_ID: "33333333-3333-4333-8333-333333333333",
      ENTRA_CLIENT_SECRET: "unit-test-placeholder",
      AUTH_SECRET: "unit-test-only-secret-with-32-characters",
      AUTH_URL: "https://example.invalid",
      APP_ORIGIN: "https://example.invalid",
    });
    assert.ok(entraSettings());
    await migrate();
    await db
      .insert(users)
      .values({
        id: oid,
        name: "Test Staff",
        email: "staff@example.invalid",
        role: "Staff",
        team: "Grants",
      });
    assert.equal(
      (await provisionedEntraUser({ tid: tenant, oid }))?.role,
      "Staff",
    );
    assert.equal(
      await provisionedEntraUser({
        tid: "44444444-4444-4444-8444-444444444444",
        oid,
      }),
      null,
    );
    assert.equal(
      await provisionedEntraUser({
        tid: tenant,
        oid: "55555555-5555-4555-8555-555555555555",
        email: "staff@example.invalid",
        roles: ["Admin"],
      }),
      null,
    );
    assert.equal(
      await provisionedEntraUser({
        tid: tenant,
        email: "staff@example.invalid",
      }),
      null,
    );
    await db.update(users).set({ role: "Disabled" });
    assert.equal(await provisionedEntraUser({ tid: tenant, oid }), null);
    process.env.ENTRA_TENANT_ID = "common";
    assert.equal(entraSettings(), null);
    process.env.ENTRA_TENANT_ID = tenant;
    process.env.AUTH_SECRET = "short";
    assert.equal(entraSettings(), null);
  } finally {
    await engine.close();
  }
});
