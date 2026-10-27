import { NextResponse } from "next/server";
import { currentUser, checkOrigin } from "@/lib/auth";
import { previewUpload, confirmImport, MAX_FILE } from "@/lib/imports";
import { limitedJson, limitedForm } from "@/lib/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const actor = await currentUser();
    if (Number(request.headers.get("content-length")) > MAX_FILE + 100000)
      throw new Error("Upload exceeds 10 MB");
    if (request.headers.get("content-type")?.includes("application/json"))
      return NextResponse.json(
        await confirmImport(await limitedJson(request, MAX_FILE), actor),
      );
    const data = await limitedForm(request, MAX_FILE + 100000);
    const file = data.get("file");
    if (!(file instanceof File)) throw new Error("Choose a file");
    return NextResponse.json(
      await previewUpload(
        Buffer.from(await file.arrayBuffer()),
        file.name,
        actor,
      ),
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Import failed" },
      { status: 400 },
    );
  }
}
