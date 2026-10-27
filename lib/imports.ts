import path from "node:path";
import { putFile, readStoredFile, deleteFile } from "./storage";
export { uploadRoot } from "./storage";
import { randomUUID } from "node:crypto";
import { parse } from "csv-parse/sync";
import ExcelJS from "exceljs";
import mammoth from "mammoth";
import { unzipSync } from "fflate";
import { eq } from "drizzle-orm";
import { db, transaction } from "./db";
import * as s from "./db/schema";
import { type Actor } from "./auth";
import { audit, createGrant, id, now, updateGrant } from "./grants";
import { grantInput } from "./validation";
export const MAX_FILE = 4 * 1024 * 1024;
export const importFields = [
  "name",
  "programId",
  "cycle",
  "organization",
  "externalId",
  "requested",
  "awarded",
  "applicationDeadline",
  "startDate",
  "endDate",
  "reporting",
  "milestones",
] as const;
export type ImportField = (typeof importFields)[number];
const aliases: Record<ImportField, string[]> = {
  name: ["grant name", "project title", "project name", "name"],
  programId: ["funding program", "program", "programid"],
  cycle: ["funding cycle", "year", "cycle"],
  organization: [
    "organization",
    "applicant",
    "recipient",
    "applicant organization",
  ],
  externalId: ["grant id", "application id", "externalid", "external grant id"],
  requested: ["requested amount", "funding requested", "requested"],
  awarded: ["awarded amount", "funding awarded", "awarded"],
  applicationDeadline: ["application deadline", "deadline"],
  startDate: ["contract start date", "start date", "startdate"],
  endDate: ["contract end date", "end date", "enddate"],
  reporting: ["reporting requirements", "reporting"],
  milestones: ["important milestones", "milestones"],
};
export function suggestMapping(headers: string[]) {
  return Object.fromEntries(
    importFields.map((f) => [
      f,
      headers.find((h) => aliases[f].includes(h.toLowerCase().trim())) || "",
    ]),
  );
}
export function validateFile(buffer: Buffer, name: string) {
  if (!buffer.length || buffer.length > MAX_FILE)
    throw new Error("Files must be between 1 byte and 4 MB");
  const ext = path.extname(name).toLowerCase();
  if (![".pdf", ".docx", ".xlsx", ".csv"].includes(ext))
    throw new Error("Allowed file types: PDF, DOCX, XLSX, CSV");
  if (ext === ".pdf" && buffer.subarray(0, 5).toString() !== "%PDF-")
    throw new Error("File content does not match PDF");
  if (
    ext === ".csv" &&
    (buffer.includes(0) || buffer.subarray(0, 2).toString() === "PK")
  )
    throw new Error("CSV must be a text file");
  if (ext === ".docx" || ext === ".xlsx") {
    if (buffer.subarray(0, 2).toString() !== "PK")
      throw new Error("Invalid Office document");
    let expanded = 0;
    let count = 0;
    let excessive = false;
    const files = unzipSync(buffer, {
      filter: (file) => {
        expanded += file.originalSize;
        count++;
        if (
          expanded > 30 * 1024 * 1024 ||
          count > 2000 ||
          file.originalSize > 15 * 1024 * 1024
        ) {
          excessive = true;
          return false;
        }
        return true;
      },
    });
    if (excessive)
      throw new Error("Office document exceeds expanded-size limits");
    const names = Object.keys(files);
    if (
      !names.includes("[Content_Types].xml") ||
      !names.includes(ext === ".docx" ? "word/document.xml" : "xl/workbook.xml")
    )
      throw new Error("File content does not match its extension");
    if (names.some((n) => /vbaProject|embeddings\/|activeX\//i.test(n)))
      throw new Error("Embedded objects and macros are not allowed");
  }
  return ext;
}
function scalar(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (v && typeof v === "object") {
    if ("formula" in v)
      throw new Error("Formula cells are not accepted; export values as CSV");
    if ("richText" in v)
      return (
        v as {
          richText: {
            text: string;
          }[];
        }
      ).richText
        .map((x) => x.text)
        .join("");
    if ("text" in v)
      return String(
        (
          v as {
            text: unknown;
          }
        ).text,
      );
  }
  return v == null ? "" : String(v);
}
export async function extract(buffer: Buffer, name: string) {
  const ext = validateFile(buffer, name);
  let rows: Record<string, string>[] = [];
  let headers: string[] = [];
  let text = "";
  if (ext === ".csv") {
    const records = parse(buffer.toString("utf8").replace(/^\uFEFF/, ""), {
      bom: true,
      skip_empty_lines: true,
      max_record_size: 100000,
    }) as string[][];
    headers = records.shift() || [];
    rows = records.map((c) =>
      Object.fromEntries(headers.map((h, i) => [h, c[i] || ""])),
    );
  } else if (ext === ".xlsx") {
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(buffer as never);
    const sheet = book.worksheets[0];
    if (!sheet) throw new Error("Workbook has no worksheet");
    if (sheet.rowCount > 501 || sheet.columnCount > 100)
      throw new Error("Limit spreadsheets to 500 rows and 100 columns");
    sheet.eachRow((row, i) => {
      const values = Array.from({ length: sheet.columnCount }, (_, j) =>
        scalar(row.getCell(j + 1).value),
      );
      if (i === 1) headers = values;
      else rows.push(Object.fromEntries(headers.map((h, j) => [h, values[j]])));
    });
  } else {
    if (ext === ".docx")
      text = (await mammoth.extractRawText({ buffer })).value;
    else {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      try {
        const info = await parser.getInfo();
        if (info.total > 100) throw new Error("Limit PDFs to 100 pages");
        text = (await parser.getText()).text;
      } finally {
        await parser.destroy();
      }
    }
    const row: Record<string, string> = {};
    for (const field of importFields) {
      for (const label of aliases[field]) {
        const line = text.split(/\r?\n/).find((l) =>
          l
            .toLowerCase()
            .trim()
            .startsWith(label + ":"),
        );
        if (line) {
          row[aliases[field][0]] = line.slice(line.indexOf(":") + 1).trim();
          break;
        }
      }
    }
    headers = Object.keys(row);
    rows = [row];
  }
  if (rows.length > 500 || headers.length > 100)
    throw new Error("Import limit: 500 grants and 100 columns");
  if (
    new Set(headers).size !== headers.length ||
    headers.some((h) => !h.trim())
  )
    throw new Error("Column headers must be unique and nonempty");
  if (!rows.length) throw new Error("No records found");
  return {
    headers,
    rows,
    mapping: suggestMapping(headers),
    warnings:
      ext === ".pdf" || ext === ".docx"
        ? [
            "Only explicitly labeled fields are extracted. Scanned PDFs require text recognition before import. Review all dates and amounts.",
          ]
        : [
            "Only the first worksheet is read. Amounts are interpreted as USD. Use ISO dates (YYYY-MM-DD).",
          ],
  };
}
export function mappedRow(
  row: Record<string, string>,
  mapping: Record<string, string>,
) {
  const result: Record<string, unknown> = {};
  for (const field of importFields) {
    const value = row[mapping[field]]?.trim();
    if (!value) continue;
    if (field === "requested" || field === "awarded") {
      const dollars = Number(value.replace(/[$,]/g, ""));
      if (!Number.isFinite(dollars) || dollars < 0)
        throw new Error(`Invalid ${field} amount`);
      result[field] = Math.round(dollars * 100);
    } else if (field === "programId") {
      const program = ["HHAP", "CoC", "YHDP", "Other"].find(
        (x) => x.toLowerCase() === value.toLowerCase(),
      );
      if (!program) throw new Error("Unknown funding program");
      result[field] = program;
    } else result[field] = value;
  }
  return result;
}
export async function duplicates(input: {
  externalId?: string | null;
  name?: string;
}) {
  return (await db.select().from(s.grants))
    .filter((g) =>
      input.externalId
        ? g.externalId === input.externalId
        : g.name.toLowerCase() === input.name?.toLowerCase(),
    )
    .map((g) => ({ id: g.id, name: g.name, externalId: g.externalId }));
}
type Preview = {
  actorId: string;
  createdAt: number;
  name: string;
  path: string;
  size: number;
  headers: string[];
  rows: Record<string, string>[];
  mapping: Record<string, string>;
  warnings: string[];
};
export async function previewUpload(
  buffer: Buffer,
  name: string,
  actor: Actor,
) {
  const parsed = await extract(buffer, name);
  const token = randomUUID();
  const filePath = token + path.extname(name).toLowerCase();
  const preview: Preview = {
    ...parsed,
    actorId: actor.id,
    createdAt: Date.now(),
    name: path
      .basename(name)
      .replace(/[\r\n]/g, "")
      .slice(0, 200),
    path: filePath,
    size: buffer.length,
  };
  await putFile(filePath, buffer);
  try {
    await putFile(token + ".json", JSON.stringify(preview));
  } catch (error) {
    await deleteFile(filePath).catch(() => {});
    throw error;
  }
  return { token, ...parsed };
}
export async function confirmImport(raw: unknown, actor: Actor) {
  const { z } = await import("zod");
  const input = z
    .object({
      token: z.uuid(),
      rows: z.array(z.record(z.string(), z.unknown())).min(1).max(500),
      duplicateMode: z.enum(["skip", "update"]).default("skip"),
      mappingName: z.string().trim().max(100).optional(),
      mapping: z.record(z.string(), z.string()).optional(),
    })
    .parse(raw);
  const location = input.token + ".json";
  const preview = JSON.parse(
    (await readStoredFile(location)).toString("utf8"),
  ) as Preview;
  if (
    preview.actorId !== actor.id ||
    Date.now() - preview.createdAt > 60 * 60 * 1000
  )
    throw new Error("Import preview expired or belongs to another user");
  const counts = {
    imported: 0,
    updated: 0,
    skipped: 0,
    errors: [] as {
      row: number;
      message: string;
    }[],
  };
  await transaction(async () => {
    if (
      (
        await db
          .select()
          .from(s.auditLogs)
          .where(eq(s.auditLogs.action, "Import " + input.token))
          .limit(1)
      )[0]
    )
      throw new Error("This import was already confirmed");
    await (async () => {
      for (const [index, value] of input.rows.entries())
        await (async (raw, i) => {
          try {
            await transaction(async () => {
              const parsed = grantInput.parse(raw);
              const match = parsed.externalId
                ? (
                    await db
                      .select()
                      .from(s.grants)
                      .where(eq(s.grants.externalId, parsed.externalId))
                      .limit(1)
                  )[0]
                : null;
              if (match && input.duplicateMode === "skip") {
                counts.skipped++;
                return;
              }
              let grantId: string;
              let cycleId = parsed.cycleId;
              if (
                typeof raw.cycle === "string" &&
                raw.cycle.trim() &&
                !cycleId
              ) {
                let c = (await db.select().from(s.cycles)).find(
                  (c) =>
                    c.name === raw.cycle && c.programId === parsed.programId,
                );
                if (!c) {
                  c = {
                    id: id(),
                    name: raw.cycle.trim().slice(0, 200),
                    programId: parsed.programId,
                    paused: false,
                  };
                  await db.insert(s.cycles).values(c);
                }
                cycleId = c.id;
              }
              if (match) {
                const meaningful = Object.fromEntries(
                  Object.entries(parsed).filter(
                    ([, v]) => v !== null && v !== undefined && v !== "",
                  ),
                );
                await updateGrant(
                  match.id,
                  { ...meaningful, cycleId: cycleId || match.cycleId },
                  actor,
                );
                grantId = match.id;
              } else grantId = await createGrant({ ...parsed, cycleId }, actor);
              await db.insert(s.documents).values({
                id: id(),
                grantId,
                name: preview.name,
                path: preview.path,
                size: preview.size,
                createdBy: actor.id,
                createdAt: now(),
              });
              await audit(actor, grantId, "Import confirmed", {
                file: preview.name,
                updated: !!match,
              });
              if (match) counts.updated++;
              else counts.imported++;
            });
          } catch (error) {
            counts.errors.push({
              row: i + 1,
              message: error instanceof Error ? error.message : "Invalid row",
            });
          }
        })(value, index);
    })();
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
    await audit(actor, null, "Import " + input.token, counts);
  });
  await deleteFile(location).catch(() =>
    console.error("Committed import preview cleanup failed"),
  );
  return counts;
}
export function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}
