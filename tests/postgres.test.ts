import { test } from "node:test";
import assert from "node:assert/strict";
import { getTableName, eq } from "drizzle-orm";
import { testDatabase } from "./helpers/database";
import { db, transaction } from "../lib/db";
import { migrate } from "../lib/db/migrate";
import { seed } from "../lib/db/seed";
import {
  transferTables,
  restoreSnapshot,
  type Snapshot,
} from "../lib/db/transfer";
import * as s from "../lib/db/schema";
import { createGrant, getGrant, addComment, advanceGrant } from "../lib/grants";

test("PostgreSQL provisioning, savepoints and legacy record transfer", async () => {
  let engine = await testDatabase();
  try {
    await migrate();
    await migrate();
    const admin = {
      id: "real-admin",
      name: "Test Administrator",
      email: "admin@example.invalid",
      role: "Admin",
      team: "Grants",
    };
    await seed(false, admin);
    await seed(false, admin);
    assert.deepEqual(
      (await db.select().from(s.users)).map((u) => u.id),
      [admin.id],
    );
    const grantId = await createGrant(
      {
        name: "Large award",
        templateId: "active",
        managerId: admin.id,
        requested: 500_000_000_00,
      },
      admin,
    );
    assert.equal((await getGrant(grantId)).requested, 500_000_000_00);
    await addComment(
      grantId,
      (await getGrant(grantId)).current.id,
      "Preserved note",
      "Update",
      admin,
    );
    await assert.rejects(
      () =>
        transaction(async () => {
          await createGrant(
            {
              name: "Must roll back",
              templateId: "active",
              managerId: admin.id,
            },
            admin,
          );
          throw new Error("Force outer rollback");
        }),
      /outer rollback/,
    );
    assert.equal((await db.select().from(s.grants)).length, 1);
    await transaction(async () => {
      await assert.rejects(() =>
        transaction(async () => {
          await db
            .insert(s.programs)
            .values({ id: "temporary", name: "Must roll back" });
          await db
            .insert(s.programs)
            .values({ id: "temporary", name: "Duplicate" });
        }),
      );
      await db
        .insert(s.mappings)
        .values({ id: "retained", name: "After savepoint", fields: "{}" });
    });
    assert.equal(
      (await db.select().from(s.programs).where(eq(s.programs.id, "temporary")))
        .length,
      0,
    );
    assert.equal((await db.select().from(s.mappings)).length, 1);
    const expectedStageId = (await getGrant(grantId)).current.id;
    const attempts = await Promise.allSettled([
      advanceGrant(grantId, admin, { expectedStageId }),
      advanceGrant(grantId, admin, { expectedStageId }),
    ]);
    assert.equal(attempts.filter((a) => a.status === "fulfilled").length, 1);
    const snapshot: Snapshot = {};
    for (const table of transferTables)
      snapshot[getTableName(table)] = (await db.select().from(table)).map(
        (row) =>
          Object.fromEntries(
            Object.entries(row).map(([k, v]) => [
              k,
              typeof v === "boolean" ? Number(v) : v,
            ]),
          ),
      );
    await engine.close();
    engine = await testDatabase();
    await migrate();
    const broken = structuredClone(snapshot);
    broken.stages[0].ownerId = "missing-user";
    await assert.rejects(() => restoreSnapshot(broken));
    assert.equal((await db.select().from(s.users)).length, 0);
    await restoreSnapshot(snapshot);
    assert.equal((await getGrant(grantId)).requested, 500_000_000_00);
    assert.equal((await getGrant(grantId)).currentPosition, 1);
    assert.equal(
      (await db.select().from(s.comments))[0].text,
      "Preserved note",
    );
    assert.equal(
      (await db.select().from(s.auditLogs)).length,
      snapshot.audit_logs.length,
    );
    await assert.rejects(
      () => restoreSnapshot(snapshot),
      /destination must be empty/,
    );
  } finally {
    await engine.close();
  }
});
