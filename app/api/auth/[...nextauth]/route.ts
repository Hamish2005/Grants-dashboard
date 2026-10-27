import type { NextRequest } from "next/server";
import { handlers } from "@/auth";
import { entraSettings } from "@/lib/entra";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  if (!entraSettings())
    return Response.json(
      { error: "Staff sign-in is not configured" },
      { status: 503 },
    );
  return handlers.GET(request);
}
export async function POST(request: NextRequest) {
  if (!entraSettings())
    return Response.json(
      { error: "Staff sign-in is not configured" },
      { status: 503 },
    );
  return handlers.POST(request);
}
