import type { users } from "./db/schema";
export type Actor = typeof users.$inferSelect;
export function requireRole(actor: Actor, roles: string[]) {
  if (!roles.includes(actor.role))
    throw new Error("Forbidden: your role cannot perform this action");
}
