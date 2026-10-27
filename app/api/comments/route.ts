import { NextResponse } from "next/server";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { currentUser, checkOrigin } from "@/lib/auth";
import { limitedForm } from "@/lib/http";
import { validateFile, uploadRoot, MAX_FILE } from "@/lib/imports";
import { addComment, id, now, audit } from "@/lib/grants";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
export async function POST(request: Request) {
  let saved: string | undefined;
  try {
    checkOrigin(request);
    const actor = await currentUser();
    const form = await limitedForm(request, MAX_FILE + 100000);
    const grantId = String(form.get("grantId") || "");
    const stageId = String(form.get("stageId") || "");
    const text = String(form.get("text") || "");
    const indicator = String(form.get("indicator") || "Update");
    const file = form.get("file");
    let attachment: { name: string; path: string; size: number } | undefined;
    if (file instanceof File && file.size) {
      const bytes = Buffer.from(await file.arrayBuffer());
      const ext = validateFile(bytes, file.name);
      const filename = id() + ext;
      await mkdir(uploadRoot(), { recursive: true });
      saved = path.join(uploadRoot(), filename);
      await writeFile(saved, bytes, { flag: "wx", mode: 0o600 });
      attachment = {
        name: path
          .basename(file.name)
          .replace(/[\r\n]/g, "")
          .slice(0, 200),
        path: filename,
        size: bytes.length,
      };
    }
    const commentId = db.transaction(() => {
      const commentId = addComment(grantId, stageId, text, indicator, actor);
      if (attachment) {
        db.insert(documents)
          .values({
            id: id(),
            grantId,
            stageId,
            commentId,
            ...attachment,
            createdBy: actor.id,
            createdAt: now(),
          })
          .run();
        audit(actor, grantId, "Comment attachment uploaded", {
          commentId,
          name: attachment.name,
        });
      }
      return commentId;
    });
    return NextResponse.json({ id: commentId });
  } catch (e) {
    if (saved) await unlink(saved).catch(() => {});
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Comment failed" },
      { status: 400 },
    );
  }
}
