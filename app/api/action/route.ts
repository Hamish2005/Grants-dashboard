import { NextResponse } from "next/server";
import { currentUser, checkOrigin } from "@/lib/auth";
import { db, transaction } from "@/lib/db";
import { createGrantService } from "@/lib/grant-service";
import { executeAction } from "@/lib/actions";
import { limitedJson } from "@/lib/http";
const service = createGrantService(db, transaction);
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const actor = await currentUser();
    if (Number(request.headers.get("content-length")) > 1000000)
      throw new Error("Request too large");
    const result = await executeAction(
      await limitedJson(request),
      actor,
      db,
      transaction,
      service,
    );
    return NextResponse.json(result);
  } catch (e) {
    const error = e instanceof Error ? e.message : "Request failed";
    return NextResponse.json(
      { error },
      {
        status: error.startsWith("Forbidden")
          ? 403
          : error.startsWith("Unauthorized")
            ? 401
            : 400,
      },
    );
  }
}
