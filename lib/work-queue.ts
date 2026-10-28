import { isNull } from "drizzle-orm";
import { db } from "./db";
import { tasks } from "./db/schema";
import { listGrants, referenceData } from "./grants";
import { buildWorkItems } from "./build-work-items";
export async function listWorkItems(ownerId?: string) {
  return buildWorkItems(
    await listGrants(),
    (await referenceData()).users,
    await db.select().from(tasks).where(isNull(tasks.completedAt)),
    ownerId,
  );
}
