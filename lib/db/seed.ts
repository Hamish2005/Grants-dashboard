import { db, transaction } from "./index";
import { createGrantService } from "../grant-service";
import { seedWorkspace } from "./seed-workspace";
import type { users } from "./schema";
export async function seed(
  includeDemo = true,
  administrator?: typeof users.$inferInsert,
) {
  return seedWorkspace(
    db,
    transaction,
    createGrantService(db, transaction),
    includeDemo,
    administrator,
  );
}
