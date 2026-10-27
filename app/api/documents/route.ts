import { NextResponse } from "next/server";
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { currentUser, checkOrigin } from "@/lib/auth";
import { editable, id, now, audit } from "@/lib/grants";
import { validateFile, uploadRoot, MAX_FILE } from "@/lib/imports";
import { limitedForm } from "@/lib/http";
export async function POST(request: Request) {
  let filePath: string | undefined;
  try {
    checkOrigin(request);
    const actor = await currentUser();
    if (Number(request.headers.get("content-length")) > MAX_FILE + 100000)
      throw new Error("Upload exceeds 10 MB");
    const data = await limitedForm(request, MAX_FILE + 100000);
    const grantId = String(data.get("grantId"));
    const stageId = String(data.get("stageId"));
    const grant = editable(grantId, actor);
    if (!grant.stages.some((s) => s.id === stageId))
      throw new Error("Invalid stage");
    const file = data.get("file");
    if (!(file instanceof File)) throw new Error("Choose a file");
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = validateFile(buffer, file.name);
    const docId = id();
    const filename = docId + ext;
    await mkdir(uploadRoot(), { recursive: true });
    filePath = path.join(uploadRoot(), filename);
    await writeFile(filePath, buffer, { flag: "wx", mode: 0o600 });
    db.transaction(() => {
      db.insert(documents)
        .values({
          id: docId,
          grantId,
          stageId,
          name: path
            .basename(file.name)
            .replace(/[\r\n]/g, "")
            .slice(0, 200),
          path: filename,
          size: buffer.length,
          createdBy: actor.id,
          createdAt: now(),
        })
        .run();
      audit(actor, grantId, "Document uploaded", { name: file.name, stageId });
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (filePath) await unlink(filePath).catch(() => {});
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 400 },
    );
  }
}
export async function GET(request: Request) {
  await currentUser();
  const doc = db
    .select()
    .from(documents)
    .where(eq(documents.id, new URL(request.url).searchParams.get("id") || ""))
    .get();
  if (!doc?.path) return new Response("Not found", { status: 404 });
  const buffer = await readFile(
    path.join(uploadRoot(), path.basename(doc.path)),
  );
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(doc.name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
