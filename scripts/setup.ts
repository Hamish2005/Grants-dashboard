import { migrate } from "../lib/db";
import { seed } from "../lib/db/seed";
migrate();
seed(!process.argv.includes("--no-demo"));
console.log(
  "Database ready. Seed accounts are fictional and development-only.",
);
