import { eq } from "drizzle-orm";
import { db } from "./db";
import { users } from "./db/schema";

const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function entraSettings() {
  const tenantId = process.env.ENTRA_TENANT_ID;
  const clientId = process.env.ENTRA_CLIENT_ID;
  const clientSecret = process.env.ENTRA_CLIENT_SECRET;
  const secret = process.env.AUTH_SECRET;
  const origin = process.env.AUTH_URL;
  if (!origin || origin !== process.env.APP_ORIGIN) return null;
  try {
    const url = new URL(origin);
    if (
      url.origin !== origin ||
      (process.env.NODE_ENV === "production" && url.protocol !== "https:")
    )
      return null;
  } catch {
    return null;
  }
  if (
    process.env.AUTH_MODE !== "entra" ||
    !tenantId ||
    !guid.test(tenantId) ||
    !clientId ||
    !guid.test(clientId) ||
    !clientSecret ||
    !secret ||
    secret.length < 32
  )
    return null;
  return { tenantId: tenantId.toLowerCase(), clientId, clientSecret, secret };
}

// Called only with the profile Auth.js obtains from a validated OIDC flow.
// Email addresses, display names and client-provided roles never grant access.
export async function provisionedEntraUser(profile: unknown) {
  const settings = entraSettings();
  if (!profile || typeof profile !== "object") return null;
  const { tid, oid } = profile as Record<string, unknown>;
  if (
    !settings ||
    typeof tid !== "string" ||
    tid.toLowerCase() !== settings.tenantId ||
    typeof oid !== "string" ||
    !guid.test(oid)
  )
    return null;
  const user = (
    await db
      .select()
      .from(users)
      .where(eq(users.id, oid.toLowerCase()))
      .limit(1)
  )[0];
  return user && ["Admin", "Manager", "Staff"].includes(user.role)
    ? user
    : null;
}
