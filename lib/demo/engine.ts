import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { desc, eq, inArray, isNull } from "drizzle-orm";
import { parse } from "csv-parse/browser/esm/sync";
import { z } from "zod";
import * as s from "../db/schema";
import { createGrantService, id, now } from "../grant-service";
import { seedWorkspace } from "../db/seed-workspace";
import { executeAction } from "../actions";
import { buildWorkItems } from "../build-work-items";
import { csvCell, suggestMapping } from "../import-fields";
import { grantInput } from "../validation";
import { addDays, today } from "../utils";

// All operations are serialized, including reads, so transaction context cannot
// leak across concurrent React refreshes. This database never uses the network.
let queue: Promise<unknown> = Promise.resolve();
function exclusive<T>(work: () => Promise<T>): Promise<T> {
  const next = queue.then(work);
  queue = next.catch(() => {});
  return next;
}
let instance: ReturnType<typeof initialize> | undefined;
function engine() {
  return (instance ??= initialize());
}
async function initialize() {
  if (!navigator.locks)
    throw new Error(
      "Use a current browser with local storage enabled to try the demo.",
    );
  await new Promise<void>((resolve, reject) => {
    void navigator.locks
      .request("rtfh-demo-v1", { ifAvailable: true }, async (lock) => {
        if (!lock) {
          reject(
            new Error(
              "This demo is open in another tab. Close that tab, then reload this page.",
            ),
          );
          return;
        }
        resolve();
        await new Promise(() => {}); // Released automatically when the document closes.
      })
      .catch(reject);
  });
  async function asset(name: string) {
    const response = await fetch(`/demo-assets/${name}`);
    if (!response.ok)
      throw new Error("Demo files could not load. Reload to retry.");
    return response;
  }
  const [wasm, initdb, data, schema] = await Promise.all([
    asset("pglite.wasm")
      .then((r) => r.arrayBuffer())
      .then((b) => WebAssembly.compile(b)),
    asset("initdb.wasm")
      .then((r) => r.arrayBuffer())
      .then((b) => WebAssembly.compile(b)),
    asset("pglite.data").then((r) => r.blob()),
    asset("schema.sql").then((r) => r.text()),
  ]);
  const client = new PGlite({
    dataDir: "idb://rtfh-demo-v1",
    pgliteWasmModule: wasm,
    initdbWasmModule: initdb,
    fsBundle: data,
  });
  await client.waitReady;
  await client.exec(
    "CREATE TABLE IF NOT EXISTS demo_migrations (version integer PRIMARY KEY)",
  );
  await client.transaction(async (tx) => {
    if (
      !(await tx.query("SELECT version FROM demo_migrations WHERE version = 1"))
        .rows.length
    ) {
      await tx.exec(schema);
      await tx.query("INSERT INTO demo_migrations VALUES (1)");
    }
  });
  await client.exec(
    "CREATE TABLE IF NOT EXISTS demo_files (id text PRIMARY KEY, bytes bytea NOT NULL); CREATE TABLE IF NOT EXISTS demo_previews (id text PRIMARY KEY);",
  );
  const base = drizzle(client, { schema: s }) as unknown as NodePgDatabase<
    typeof s
  >;
  let active = base;
  const db = new Proxy(base, {
    get(_target, prop) {
      const value = Reflect.get(active, prop);
      return typeof value === "function" ? value.bind(active) : value;
    },
  });
  async function transaction<T>(work: () => Promise<T>): Promise<T> {
    const parent = active;
    return parent.transaction(async (tx) => {
      active = tx as unknown as typeof base;
      try {
        return await work();
      } finally {
        active = parent;
      }
    });
  }
  const service = createGrantService(db, transaction);
  async function seed() {
    const empty = !(await db.select().from(s.users)).length;
    await seedWorkspace(db, transaction, service);
    if (empty) {
      const grant = (await service.listGrants()).find(
        (g) => g.managerId === "alex",
      )!;
      await db
        .insert(s.tasks)
        .values({
          id: id(),
          grantId: grant.id,
          ownerId: "alex",
          name: "Review demo progress report",
          deadline: addDays(today(), 3),
        });
    }
  }
  await seed();
  const actor = (
    await db.select().from(s.users).where(eq(s.users.id, "alex"))
  )[0];
  async function attach(form: FormData, commentId?: string) {
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) throw new Error("Choose a file");
    if (file.size > 4 * 1024 * 1024) throw new Error("Upload exceeds 4 MB");
    if (!/\.(pdf|docx|xlsx|csv)$/i.test(file.name))
      throw new Error("Choose a PDF, DOCX, XLSX, or CSV attachment");
    const grantId = String(form.get("grantId"));
    const stageId = String(form.get("stageId"));
    const grant = await service.editable(grantId, actor);
    if (!grant.stages.some((st) => st.id === stageId))
      throw new Error("Invalid stage");
    const docId = id();
    // Store bytes through the active transaction alongside the document record.
    const { sql } = await import("drizzle-orm");
    const bytes = Array.from(new Uint8Array(await file.arrayBuffer()), (n) =>
      n.toString(16).padStart(2, "0"),
    ).join("");
    await db.execute(
      sql`INSERT INTO demo_files (id, bytes) VALUES (${docId}, decode(${bytes}, 'hex'))`,
    );
    await db
      .insert(s.documents)
      .values({
        id: docId,
        grantId,
        stageId,
        commentId,
        name: file.name.slice(0, 200),
        path: docId,
        size: file.size,
        createdBy: actor.id,
        createdAt: now(),
      });
    await service.audit(actor, grantId, "Document uploaded", {
      name: file.name,
      stageId,
    });
  }
  async function request(url: string, init?: RequestInit): Promise<unknown> {
    if (url === "/api/action")
      return executeAction(
        JSON.parse(String(init?.body)),
        actor,
        db,
        transaction,
        service,
      );
    if (url === "/api/comments" || url === "/api/documents") {
      const form = init?.body;
      if (!(form instanceof FormData)) throw new Error("Invalid upload");
      return transaction(async () => {
        let commentId: string | undefined;
        if (url === "/api/comments")
          commentId = await service.addComment(
            String(form.get("grantId")),
            String(form.get("stageId")),
            String(form.get("text") || ""),
            String(form.get("indicator") || "Update"),
            actor,
          );
        const file = form.get("file");
        if (url === "/api/documents" || (file instanceof File && file.size))
          await attach(form, commentId);
        return { ok: true, id: commentId };
      });
    }
    if (url === "/api/import") {
      if (init?.body instanceof FormData) {
        const file = init.body.get("file");
        if (!(file instanceof File) || !/\.csv$/i.test(file.name))
          throw new Error(
            "The browser demo supports CSV imports. Save your spreadsheet as CSV to test importing.",
          );
        if (file.size > 4 * 1024 * 1024) throw new Error("Upload exceeds 4 MB");
        const rows = parse(await file.text(), {
          columns: true,
          bom: true,
          skip_empty_lines: true,
        }) as Record<string, string>[];
        if (!rows.length || rows.length > 500)
          throw new Error("Choose a CSV with 1–500 rows");
        const headers = Object.keys(rows[0]);
        const token = id();
        await client.query("INSERT INTO demo_previews VALUES ($1)", [token]);
        return {
          token,
          headers,
          rows,
          mapping: suggestMapping(headers),
          warnings: [
            "Review all values. This import is saved only in this browser.",
          ],
        };
      }
      const input = z
        .object({
          token: z.uuid(),
          rows: z.array(z.record(z.string(), z.unknown())).min(1).max(500),
          duplicateMode: z.enum(["skip", "update"]),
          mappingName: z.string().max(100).optional(),
          mapping: z.record(z.string(), z.string()).optional(),
        })
        .parse(JSON.parse(String(init?.body)));
      const { sql } = await import("drizzle-orm");
      return transaction(async () => {
        const preview = await db.execute(
          sql`DELETE FROM demo_previews WHERE id = ${input.token} RETURNING id`,
        );
        if (!preview.rows.length)
          throw new Error("Import preview already used. Upload the CSV again.");
        const counts = {
          imported: 0,
          updated: 0,
          skipped: 0,
          errors: [] as { row: number; message: string }[],
        };
        for (const [index, raw] of input.rows.entries()) {
          try {
            const outcome = await transaction(async () => {
              const parsed = grantInput.parse(raw);
              const match = (await db.select().from(s.grants)).find((g) =>
                parsed.externalId
                  ? g.externalId === parsed.externalId
                  : g.name.toLowerCase() === parsed.name.toLowerCase(),
              );
              if (match && input.duplicateMode === "skip")
                return "skipped" as const;
              if (
                typeof raw.cycle === "string" &&
                raw.cycle.trim() &&
                !parsed.cycleId
              ) {
                const name = raw.cycle.trim();
                let cycle = (await db.select().from(s.cycles)).find(
                  (c) => c.name === name && c.programId === parsed.programId,
                );
                if (!cycle) {
                  cycle = {
                    id: id(),
                    name,
                    programId: parsed.programId,
                    paused: false,
                  };
                  await db.insert(s.cycles).values(cycle);
                }
                parsed.cycleId = cycle.id;
              }
              if (match) await service.updateGrant(match.id, parsed, actor);
              else await service.createGrant(parsed, actor, true);
              return match ? ("updated" as const) : ("imported" as const);
            });
            counts[outcome]++;
          } catch (error) {
            counts.errors.push({
              row: index + 1,
              message: (error as Error).message,
            });
          }
        }
        if (input.mappingName && input.mapping)
          await db
            .insert(s.mappings)
            .values({
              id: id(),
              name: input.mappingName,
              fields: JSON.stringify(input.mapping),
            })
            .onConflictDoUpdate({
              target: s.mappings.name,
              set: { fields: JSON.stringify(input.mapping) },
            });
        return counts;
      });
    }
    throw new Error("This action is unavailable in the browser demo");
  }
  return { db, client, service, actor, request, seed };
}
export function demoSnapshot(grantId?: string) {
  return exclusive(async () => {
    const { db, service, actor } = await engine();
    const refs = await service.referenceData();
    const allGrants = await service.listGrants(true);
    const grants = allGrants.filter((g) => !g.archived);
    const items = buildWorkItems(
      grants,
      refs.users,
      await db.select().from(s.tasks).where(isNull(s.tasks.completedAt)),
    );
    let detail;
    if (grantId) {
      const grant = await service.getGrant(grantId);
      detail = {
        grant,
        refs,
        user: actor,
        comments: await db
          .select()
          .from(s.comments)
          .where(
            inArray(
              s.comments.stageId,
              grant.stages.map((st) => st.id),
            ),
          )
          .orderBy(desc(s.comments.createdAt)),
        documents: await db
          .select()
          .from(s.documents)
          .where(eq(s.documents.grantId, grantId)),
        audit: await db
          .select()
          .from(s.auditLogs)
          .where(eq(s.auditLogs.grantId, grantId))
          .orderBy(desc(s.auditLogs.createdAt)),
        tasks: await db
          .select()
          .from(s.tasks)
          .where(eq(s.tasks.grantId, grantId)),
      };
    }
    return { refs, grants, allGrants, items, actor, detail };
  });
}
export function demoRequest(url: string, init?: RequestInit) {
  return exclusive(async () => {
    try {
      return Response.json(await (await engine()).request(url, init));
    } catch (error) {
      return Response.json(
        { error: (error as Error).message },
        { status: 400 },
      );
    }
  });
}
export function resetDemo() {
  return exclusive(async () => {
    const { client, seed } = await engine();
    await client.exec(
      "TRUNCATE users, programs, cycles, templates, template_stages, grants, stages, comments, documents, audit_logs, tasks, mappings, demo_files, demo_previews CASCADE",
    );
    await seed();
  });
}
export function downloadDemoFile(url: string) {
  return exclusive(async () => {
    const { db, client, service } = await engine();
    let name: string;
    let blob: Blob;
    if (url === "/api/export") {
      name = "demo-grants.csv";
      const rows = (await service.listGrants()).map((g) => [
        g.name,
        g.programId,
        g.organization,
        g.externalId,
        g.requested == null ? "" : g.requested / 100,
        g.awarded == null ? "" : g.awarded / 100,
        g.current.name,
        g.owner?.name,
        g.current.deadline,
        g.status,
      ]);
      blob = new Blob(
        [
          [
            [
              "Grant name",
              "Funding program",
              "Organization",
              "Grant ID",
              "Funding requested",
              "Funding awarded",
              "Current stage",
              "Stage owner",
              "Deadline",
              "Status",
            ],
            ...rows,
          ]
            .map((r) => r.map(csvCell).join(","))
            .join("\r\n"),
        ],
        { type: "text/csv" },
      );
    } else {
      const docId =
        new URL(url, window.location.origin).searchParams.get("id") || "";
      const doc = (
        await db.select().from(s.documents).where(eq(s.documents.id, docId))
      )[0];
      const file = (
        await client.query<{ bytes: Uint8Array }>(
          "SELECT bytes FROM demo_files WHERE id = $1",
          [docId],
        )
      ).rows[0];
      if (!doc || !file)
        throw new Error("Attachment not found in this browser");
      name = doc.name;
      blob = new Blob([new Uint8Array(file.bytes)], {
        type: "application/octet-stream",
      });
    }
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(href), 30000);
  });
}
