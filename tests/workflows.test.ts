import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { eq } from "drizzle-orm";
import { zipSync, strToU8 } from "fflate";
import ExcelJS from "exceljs";
test("Persistent grants, workflows, authorization and imports", async (t) => {
  const temp = mkdtempSync(path.join(os.tmpdir(), "rtfh-tests-"));
  Object.assign(process.env, { NODE_ENV: "test", STORAGE_DRIVER: "local" });
  process.env.UPLOAD_DIR = path.join(temp, "uploads");
  const { db } = await import("../lib/db");
  const { migrate } = await import("../lib/db/migrate");
  const { testDatabase } = await import("./helpers/database");
  const engine = await testDatabase();
  const s = await import("../lib/db/schema");
  const svc = await import("../lib/grants");
  const imports = await import("../lib/imports");
  const { seed } = await import("../lib/db/seed");
  try {
    await migrate();
    await seed(false);
    const actor = (
      await db.select().from(s.users).where(eq(s.users.id, "alex")).limit(1)
    )[0]!;
    const staff = (
      await db.select().from(s.users).where(eq(s.users.id, "sam")).limit(1)
    )[0]!;
    const make = async (extra: Record<string, unknown> = {}) =>
      await svc.createGrant(
        {
          name: "Fictional test project",
          templateId: "hhap",
          managerId: "alex",
          programId: "HHAP",
          ...extra,
        },
        actor,
      );
    await t.test(
      "quick add persists a normalized workflow with distinct external decision maker",
      async () => {
        const id = await make();
        const g = await svc.getGrant(id);
        assert.equal(g.stages.length, 13);
        assert.equal(g.current.status, "In Progress");
        assert.equal(g.stages[3].externalParty, "Independent Review Committee");
        assert.equal(g.stages[3].ownerId, "alex");
        assert.equal(g.stages[2].ownerId, "sam");
        assert.ok(g.id);
        assert.equal(g.requested, null);
      },
    );
    await t.test(
      "invalid inputs and duplicate IDs do not leave partial grants",
      async () => {
        const before = (await svc.listGrants()).length;
        await assert.rejects(async () => await make({ name: "" }));
        await assert.rejects(async () => await make({ startingPosition: 99 }));
        await assert.rejects(
          async () => await make({ startDate: "2026-02-30" }),
        );
        assert.equal((await svc.listGrants()).length, before);
        await make({ externalId: "TEST-001" });
        await assert.rejects(
          async () => await make({ externalId: "TEST-001" }),
          /Duplicate/,
        );
        assert.equal(
          (await imports.duplicates({ externalId: "TEST-001" })).length,
          1,
        );
      },
    );
    await t.test(
      "advance records completion and activates next stage",
      async () => {
        const id = await make({ startingPosition: 2 });
        const before = await svc.getGrant(id);
        await svc.advanceGrant(id, actor);
        const after = await svc.getGrant(id);
        assert.equal(after.currentPosition, 3);
        assert.equal(after.current.status, "In Progress");
        assert.ok(after.stages[2].completedAt);
        assert.equal(after.stages[0].completedAt, null);
        assert.equal(before.stages[0].status, "Skipped");
        assert.ok(after.current.deadline);
      },
    );
    await t.test(
      "conditional appeals require a choice and retain a skip reason",
      async () => {
        const id = await make({ startingPosition: 4 });
        await assert.rejects(
          async () => await svc.advanceGrant(id, actor),
          /appeal/,
        );
        await svc.advanceGrant(id, actor, { appeals: false });
        const g = await svc.getGrant(id);
        assert.equal(g.currentPosition, 6);
        assert.equal(g.stages[5].status, "Skipped");
        assert.equal(g.stages[5].skipReason, "No appeal required");
        const appeal = await make({ startingPosition: 4 });
        await svc.advanceGrant(appeal, actor, { appeals: true });
        assert.equal((await svc.getGrant(appeal)).currentPosition, 5);
        await assert.rejects(
          async () => await svc.advanceGrant(appeal, actor, { skip: true }),
          /reason/,
        );
        await svc.advanceGrant(appeal, actor, {
          skip: true,
          reason: "Appeal withdrawn",
        });
        assert.equal(
          (await svc.getGrant(appeal)).stages[5].skipReason,
          "Appeal withdrawn",
        );
      },
    );
    await t.test(
      "not-selected applications never enter contracting, including CoC",
      async () => {
        for (const [templateId, startingPosition] of [
          ["hhap", 6],
          ["coc", 11],
        ] as const) {
          const id = await make({ templateId, startingPosition });
          await assert.rejects(
            async () => await svc.advanceGrant(id, actor),
            /decision/,
          );
          await svc.advanceGrant(id, actor, { decision: "Not Selected" });
          const g = await svc.getGrant(id);
          assert.equal(g.status, "Not Selected");
          assert.ok(
            g.stages
              .slice(startingPosition + 1)
              .every((s) => s.status === "Skipped" && !s.actualStart),
          );
          await assert.rejects(
            async () => await svc.advanceGrant(id, actor),
            /active/,
          );
        }
      },
    );
    await t.test(
      "selected decision proceeds to contract development",
      async () => {
        const id = await make({ startingPosition: 6 });
        await svc.advanceGrant(id, actor, { decision: "Selected" });
        assert.equal((await svc.getGrant(id)).currentPosition, 7);
      },
    );
    await t.test(
      "blocking, unblocking, ownership and deadline recalculation preserve history",
      async () => {
        const id = await make({ startingPosition: 2 });
        const g = await svc.getGrant(id);
        const data = {
          ownerId: "sam",
          externalParty: null,
          duration: 3,
          plannedStart: "2026-10-01",
          deadline: "2026-10-04",
          estimated: false,
          status: "Blocked",
          recalculate: true,
        };
        await svc.updateStage(id, data, actor);
        assert.equal((await svc.getGrant(id)).current.deadline, "2026-10-04");
        await assert.rejects(
          async () => await svc.advanceGrant(id, actor),
          /blocker/,
        );
        await svc.updateStage(id, { ...data, status: "In Progress" }, staff);
        const after = await svc.getGrant(id);
        assert.equal(after.stages[3].deadline, "2026-10-09");
        assert.equal(after.stages[0].deadline, g.stages[0].deadline);
        await svc.advanceGrant(id, staff);
        assert.equal((await svc.getGrant(id)).stages[2].deadline, "2026-10-04");
      },
    );
    await t.test("comments and audit history survive transitions", async () => {
      const id = await make({ startingPosition: 2 });
      const stage = (await svc.getGrant(id)).current.id;
      await svc.addComment(id, stage, "Review complete.", "Update", staff);
      await svc.addComment(
        id,
        stage,
        "Supporting note retained.",
        "Decision",
        actor,
      );
      await svc.advanceGrant(id, actor);
      assert.equal(
        (
          await db
            .select()
            .from(s.comments)
            .where(eq(s.comments.stageId, stage))
        ).length,
        2,
      );
      assert.equal(
        (await svc.listGrants()).find((g) => g.id === id)?.latest?.text,
        "Supporting note retained.",
      );
      assert.ok(
        (await db.select().from(s.auditLogs).where(eq(s.auditLogs.grantId, id)))
          .length >= 4,
      );
    });
    await t.test(
      "paused funding cycles and grant holds prevent transitions",
      async () => {
        await db
          .insert(s.cycles)
          .values({ id: "pause-test", name: "Test cycle", programId: "HHAP" });
        const id = await make({ cycleId: "pause-test" });
        await svc.pauseCycle("pause-test", true, actor);
        await assert.rejects(
          async () => await svc.advanceGrant(id, actor),
          /paused/,
        );
        await svc.pauseCycle("pause-test", false, actor);
        await svc.setHold(id, true, actor);
        await assert.rejects(
          async () => await svc.advanceGrant(id, actor),
          /active/,
        );
        await svc.setHold(id, false, actor);
        await svc.advanceGrant(id, actor);
        assert.equal((await svc.getGrant(id)).currentPosition, 1);
      },
    );
    await t.test(
      "staff cannot modify unassigned grants or pause cycles",
      async () => {
        const id = await make();
        await assert.rejects(
          async () => await svc.advanceGrant(id, staff),
          /Forbidden/,
        );
        await assert.rejects(
          async () => await svc.updateGrant(id, { name: "Changed" }, staff),
          /Forbidden/,
        );
        await assert.rejects(
          async () => await svc.pauseCycle("pause-test", true, staff),
          /Forbidden/,
        );
      },
    );
    await t.test(
      "CSV extraction, custom mappings and formula-safe export",
      async () => {
        const result = await imports.extract(
          Buffer.from(
            'Project title,Grant ID,Requested amount\nExample grant,X-1,"$1,234.50"\n',
          ),
          "export.csv",
        );
        assert.equal(result.rows.length, 1);
        const row = imports.mappedRow(result.rows[0], result.mapping);
        assert.equal(row.name, "Example grant");
        assert.equal(row.requested, 123450);
        assert.equal(row.externalId, "X-1");
        assert.equal(
          imports.csvCell('=HYPERLINK("x")'),
          '"\'=HYPERLINK(""x"")"',
        );
      },
    );
    await t.test("XLSX extracts rows and rejects formulas", async () => {
      const book = new ExcelJS.Workbook();
      const sheet = book.addWorksheet("Grants");
      sheet.addRow(["Grant name", "Funding awarded"]);
      sheet.addRow(["Workbook project", 4200]);
      const bytes = Buffer.from(await book.xlsx.writeBuffer());
      const result = await imports.extract(bytes, "grants.xlsx");
      assert.equal(result.rows[0]["Grant name"], "Workbook project");
      sheet.getCell("B2").value = { formula: "2+2", result: 4 };
      await assert.rejects(
        () => imports.extract(Buffer.from([]), "grants.xlsx"),
        /between/,
      );
      const formulas = Buffer.from(await book.xlsx.writeBuffer());
      await assert.rejects(
        () => imports.extract(formulas, "grants.xlsx"),
        /Formula/,
      );
    });
    await t.test(
      "DOCX extracts explicit labels without external services",
      async () => {
        const bytes = Buffer.from(
          zipSync({
            "[Content_Types].xml": strToU8(
              '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
            ),
            "word/document.xml": strToU8(
              '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Grant name: Fictional document project</w:t></w:r></w:p><w:p><w:r><w:t>Funding awarded: $5,000</w:t></w:r></w:p></w:body></w:document>',
            ),
          }),
        );
        const result = await imports.extract(bytes, "project.docx");
        const row = imports.mappedRow(result.rows[0], result.mapping);
        assert.equal(row.name, "Fictional document project");
        assert.equal(row.awarded, 500000);
      },
    );
    await t.test("PDF extraction reads labeled text", async () => {
      const stream =
        "BT /F1 12 Tf 50 750 Td (Grant name: PDF test project) Tj ET";
      const objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
      ];
      let pdf = "%PDF-1.4\n";
      const offsets = [0];
      objects.forEach((o, i) => {
        offsets.push(Buffer.byteLength(pdf));
        pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
      });
      const offset = Buffer.byteLength(pdf);
      pdf +=
        "xref\n0 6\n0000000000 65535 f \n" +
        offsets
          .slice(1)
          .map((n) => String(n).padStart(10, "0") + " 00000 n \n")
          .join("") +
        `trailer\n<< /Root 1 0 R /Size 6 >>\nstartxref\n${offset}\n%%EOF`;
      const result = await imports.extract(Buffer.from(pdf), "project.pdf");
      assert.equal(
        imports.mappedRow(result.rows[0], result.mapping).name,
        "PDF test project",
      );
    });
    await t.test(
      "file validation rejects spoofed, oversized and unsafe archives",
      () => {
        assert.throws(
          () => imports.validateFile(Buffer.from("hello"), "bad.pdf"),
          /match/,
        );
        assert.throws(
          () => imports.validateFile(Buffer.from("hello"), "bad.exe"),
          /Allowed/,
        );
        assert.throws(
          () =>
            imports.validateFile(Buffer.alloc(imports.MAX_FILE + 1), "big.csv"),
          /4 MB/,
        );
        assert.throws(
          () => imports.validateFile(Buffer.from("bad"), "bad.docx"),
          /Invalid/,
        );
        const bad = Buffer.from(
          zipSync({
            "[Content_Types].xml": strToU8("x"),
            "word/document.xml": strToU8("x"),
            "word/vbaProject.bin": strToU8("x"),
          }),
        );
        assert.throws(() => imports.validateFile(bad, "bad.docx"), /macros/);
      },
    );
    await t.test(
      "preview persists files but creates no grant until confirmation; duplicate skip/update counts",
      async () => {
        const before = (await svc.listGrants()).length;
        const preview = await imports.previewUpload(
          Buffer.from("Grant name,Grant ID\nImported grant,IMPORT-1"),
          "import.csv",
          actor,
        );
        assert.equal((await svc.listGrants()).length, before);
        const row = {
          name: "Imported grant",
          externalId: "IMPORT-1",
          templateId: "active",
          managerId: "alex",
          programId: "Other",
        };
        const counts = await imports.confirmImport(
          {
            token: preview.token,
            rows: [row, row, { ...row, name: "", externalId: "bad" }],
            mappingName: "Test mapping",
            mapping: preview.mapping,
          },
          actor,
        );
        assert.equal(counts.imported, 1);
        assert.equal(counts.skipped, 1);
        assert.equal(counts.errors.length, 1);
        assert.equal((await db.select().from(s.mappings)).length, 1);
        const g = (
          await db
            .select()
            .from(s.grants)
            .where(eq(s.grants.externalId, "IMPORT-1"))
            .limit(1)
        )[0]!;
        assert.equal(
          (
            await db
              .select()
              .from(s.documents)
              .where(eq(s.documents.grantId, g.id))
          ).length,
          1,
        );
        const p2 = await imports.previewUpload(
          Buffer.from("Grant name\nChanged name"),
          "update.csv",
          actor,
        );
        const update = await imports.confirmImport(
          {
            token: p2.token,
            rows: [{ ...row, name: "Updated imported grant" }],
            duplicateMode: "update",
          },
          actor,
        );
        assert.equal(update.updated, 1);
        assert.equal((await svc.getGrant(g.id)).name, "Updated imported grant");
        assert.equal((await svc.getGrant(g.id)).stages.length, 7);
      },
    );
    await t.test(
      "archiving removes a grant from the tracker without losing history",
      async () => {
        const grantId = await make();
        const stage = (await svc.getGrant(grantId)).current;
        await svc.addComment(
          grantId,
          stage.id,
          "Retained history",
          null,
          actor,
        );
        await assert.rejects(
          async () => await svc.archiveGrant(grantId, true, staff),
          /Forbidden/,
        );
        await svc.archiveGrant(grantId, true, actor);
        assert.equal(
          (await svc.listGrants()).some((g) => g.id === grantId),
          false,
        );
        assert.equal(
          (await svc.listGrants(true)).find((g) => g.id === grantId)?.archived,
          true,
        );
        await assert.rejects(
          async () => await svc.advanceGrant(grantId, actor),
          /archived/,
        );
        await svc.archiveGrant(grantId, false, actor);
        assert.equal((await svc.getGrant(grantId)).current.id, stage.id);
        assert.equal(
          (
            await db
              .select()
              .from(s.comments)
              .where(eq(s.comments.stageId, stage.id))
          ).length,
          1,
        );
      },
    );
    await t.test(
      "stale stage requests cannot advance or edit the next stage",
      async () => {
        const grantId = await make();
        const expectedStageId = (await svc.getGrant(grantId)).current.id;
        await svc.advanceGrant(grantId, actor, { expectedStageId });
        await assert.rejects(
          async () =>
            await svc.advanceGrant(grantId, actor, { expectedStageId }),
          /already advanced/,
        );
        await assert.rejects(
          async () =>
            await svc.updateStage(
              grantId,
              {
                ownerId: "alex",
                externalParty: null,
                duration: null,
                plannedStart: null,
                deadline: null,
                estimated: true,
                status: "In Progress",
              },
              actor,
              expectedStageId,
            ),
          /another session/,
        );
        assert.equal((await svc.getGrant(grantId)).currentPosition, 1);
      },
    );
    await t.test(
      "actual imported dates anchor future stages without shifting date-only deadlines",
      async () => {
        const grantId = await make({
          applicationDeadline: "2026-11-01",
          startDate: "2027-01-01",
          endDate: "2028-12-31",
        });
        const grant = await svc.getGrant(grantId);
        assert.equal(grant.current.deadline, "2026-11-01");
        assert.equal(grant.current.estimated, false);
        assert.equal(grant.stages[8].deadline, "2027-01-01");
        assert.equal(grant.stages[10].deadline, "2028-12-31");
        assert.equal(grant.stages[10].estimated, false);
        const { addDays, dateLabel } = await import("../lib/utils");
        assert.equal(addDays("2026-11-01", 1), "2026-11-02");
        assert.equal(dateLabel("2026-11-01"), "Nov 1, 2026");
      },
    );
    await t.test(
      "streamed request size limits cannot be bypassed by missing Content-Length",
      async () => {
        const { limitedJson } = await import("../lib/http");
        await assert.rejects(
          () =>
            limitedJson(
              new Request("http://localhost", {
                method: "POST",
                body: JSON.stringify({ large: "x".repeat(100) }),
              }),
              20,
            ),
          /size limit/,
        );
        assert.deepEqual(
          await limitedJson(
            new Request("http://localhost", {
              method: "POST",
              body: '{"ok":true}',
            }),
          ),
          { ok: true },
        );
      },
    );
    await t.test(
      "work queues combine assigned stages and reporting tasks and exclude completed or archived work",
      async () => {
        const { listWorkItems } = await import("../lib/work-queue");
        const grantId = await make({ name: "Queue regression grant" });
        const current = (await svc.getGrant(grantId)).current;
        const taskId = svc.id();
        await db.insert(s.tasks).values({
          id: taskId,
          grantId,
          ownerId: "sam",
          name: "Assigned reporting obligation",
          deadline: "2026-11-01",
        });
        assert.ok(
          (await listWorkItems("alex")).some((i) => i.id === current.id),
        );
        assert.ok(!(await listWorkItems("alex")).some((i) => i.id === taskId));
        assert.ok(
          (await listWorkItems("sam")).some(
            (i) => i.id === taskId && i.kind === "Reporting",
          ),
        );
        assert.ok(
          !(await listWorkItems("sam")).some((i) => i.id === current.id),
        );
        await svc.setHold(grantId, true, actor);
        assert.ok(
          (await listWorkItems())
            .filter((i) => i.grantId === grantId)
            .every((i) => i.paused),
        );
        await svc.setHold(grantId, false, actor);
        await svc.advanceGrant(grantId, actor);
        assert.ok(!(await listWorkItems()).some((i) => i.id === current.id));
        await db
          .update(s.tasks)
          .set({ completedAt: svc.now() })
          .where(eq(s.tasks.id, taskId));
        assert.ok(!(await listWorkItems()).some((i) => i.id === taskId));
        await svc.archiveGrant(grantId, true, actor);
        assert.ok(!(await listWorkItems()).some((i) => i.grantId === grantId));
      },
    );
    await t.test("import tokens are actor-bound", async () => {
      const preview = await imports.previewUpload(
        Buffer.from("Grant name\nPrivate import"),
        "private.csv",
        actor,
      );
      await assert.rejects(
        () =>
          imports.confirmImport(
            {
              token: preview.token,
              rows: [
                { name: "Attempt", templateId: "active", managerId: "sam" },
              ],
            },
            staff,
          ),
        /belongs/,
      );
    });
    await t.test(
      "production refuses development authentication and cross-origin writes",
      async () => {
        const { currentUser, checkOrigin } = await import("../lib/auth");
        const previous = process.env.NODE_ENV;
        Object.assign(process.env, {
          NODE_ENV: "production",
          AUTH_MODE: "development",
        });
        await assert.rejects(() => currentUser(), /disabled in production/);
        Object.assign(process.env, { NODE_ENV: previous || "test" });
        assert.throws(
          () =>
            checkOrigin(
              new Request("http://localhost:3000/api/action", {
                headers: { origin: "https://evil.invalid" },
              }),
            ),
          /origin/,
        );
      },
    );
  } finally {
    await engine.close();
    assert.equal(path.dirname(path.resolve(temp)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(temp).startsWith("rtfh-tests-"));
    rmSync(temp, { recursive: true, force: true });
  }
});
