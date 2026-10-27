import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, transaction, closeDatabase } from "../lib/db";
import { users } from "../lib/db/schema";

async function main() {
  const id = z.uuid().parse(process.env.STAFF_USER_ID).toLowerCase();
  try {
    await transaction(async () => {
      const existing = (
        await db.select().from(users).where(eq(users.id, id)).limit(1)
      )[0];
      if (process.argv.includes("--disable")) {
        if (!existing) throw new Error("Staff account not found");
        await db
          .update(users)
          .set({ role: "Disabled" })
          .where(eq(users.id, id));
        return;
      }
      const data = z
        .object({
          name: z.string().trim().min(1).max(200),
          email: z.email(),
          role: z.enum(["Staff", "Manager", "Admin"]),
          team: z.string().trim().min(1).max(200),
        })
        .parse({
          name: process.env.STAFF_USER_NAME,
          email: process.env.STAFF_USER_EMAIL,
          role: process.env.STAFF_USER_ROLE || "Staff",
          team: process.env.STAFF_USER_TEAM || "Grants & Contracts",
        });
      if (existing) {
        if (!process.argv.includes("--update"))
          throw new Error(
            "Account exists; use --update for an intentional role/profile change",
          );
        await db.update(users).set(data).where(eq(users.id, id));
      } else await db.insert(users).values({ id, ...data });
    });
    console.log("Staff account provisioning completed.");
  } finally {
    await closeDatabase();
  }
}
main().catch(() => {
  console.error(
    "Provisioning failed. Check staff settings, database access, and whether --update is required.",
  );
  process.exitCode = 1;
});
