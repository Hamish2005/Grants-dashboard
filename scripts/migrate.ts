import { migrate } from "../lib/db/migrate";
import { closeDatabase } from "../lib/db";
migrate()
  .then(() => console.log("PostgreSQL schema is current."))
  .catch(() => {
    console.error(
      "Migration failed; check PostgreSQL connectivity and permissions.",
    );
    process.exitCode = 1;
  })
  .finally(closeDatabase);
