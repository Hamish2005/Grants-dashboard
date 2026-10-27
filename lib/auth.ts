import { headers } from "next/headers";
import { jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { users } from "./db/schema";
export type Actor = typeof users.$inferSelect;
export function requireRole(actor: Actor, roles: string[]) {
  if (!roles.includes(actor.role))
    throw new Error("Forbidden: your role cannot perform this action");
}
export async function currentUser(): Promise<Actor> {
  let id: string | undefined;
  if (
    process.env.AUTH_MODE === "development" &&
    process.env.NODE_ENV !== "production"
  )
    id = process.env.DEV_USER_ID || "alex";
  else if (process.env.AUTH_MODE === "proxy") {
    const secret = process.env.AUTH_JWT_SECRET;
    if (!secret || secret.length < 32)
      throw new Error("Authentication is not configured");
    const token = (await headers()).get("x-rtfh-token");
    if (!token)
      throw new Error(
        "Unauthorized: sign in through the internal identity gateway",
      );
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret),
      {
        algorithms: ["HS256"],
        issuer: process.env.AUTH_ISSUER || "rtfh-auth-proxy",
        audience: process.env.AUTH_AUDIENCE || "rtfh-grants",
        maxTokenAge: "5m",
        requiredClaims: ["sub", "iat", "exp"],
      },
    );
    id = payload.sub;
  } else
    throw new Error(
      "Authentication required. Development authentication is disabled in production.",
    );
  const user = id
    ? db.select().from(users).where(eq(users.id, id)).get()
    : undefined;
  if (!user)
    throw new Error("Unauthorized: staff account has not been provisioned");
  return user;
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = process.env.APP_ORIGIN || "http://localhost:3000";
  if (origin !== expected)
    throw new Error("Forbidden: request origin does not match APP_ORIGIN");
}
