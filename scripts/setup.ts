import { z } from "zod";
import { closeDatabase } from "../lib/db";
import { migrate } from "../lib/db/migrate";
import { seed } from "../lib/db/seed";
async function main() {
  try {
    await migrate();
    if (process.argv.includes("--production")) {
      const {
        BOOTSTRAP_USER_ID: id,
        BOOTSTRAP_USER_NAME: name,
        BOOTSTRAP_USER_EMAIL: email,
      } = process.env;
      if (!id || !name || !email)
        throw new Error(
          "Set BOOTSTRAP_USER_ID, BOOTSTRAP_USER_NAME, and BOOTSTRAP_USER_EMAIL for the first administrator",
        );
      await seed(false, {
        id:
          process.env.AUTH_MODE === "entra"
            ? z.uuid().parse(id).toLowerCase()
            : id,
        name,
        email,
        role: "Admin",
        team: "Grants & Contracts",
      });
    } else {
      if (process.env.NODE_ENV === "production")
        throw new Error("Use --production for production provisioning");
      await seed(!process.argv.includes("--no-demo"));
    }
    console.log("PostgreSQL database ready.");
  } finally {
    await closeDatabase();
  }
}
main().catch(() => {
  console.error(
    "Database setup failed. Check PostgreSQL access and bootstrap settings; no credentials were logged.",
  );
  process.exitCode = 1;
});
