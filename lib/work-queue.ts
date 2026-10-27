import { isNull } from "drizzle-orm";
import { db } from "./db";
import { tasks } from "./db/schema";
import { listGrants, referenceData } from "./grants";
import type { WorkItem } from "./work-items";
export function listWorkItems(ownerId?: string): WorkItem[] {
  const grants = listGrants();
  const users = referenceData().users;
  const items: WorkItem[] = grants
    .filter(
      (g) =>
        ["Active", "On Hold"].includes(g.status) &&
        ["In Progress", "Blocked"].includes(g.current.status),
    )
    .map((g) => ({
      id: g.current.id,
      grantId: g.id,
      grantName: g.name,
      name: g.current.name,
      kind: "Stage",
      programId: g.programId,
      ownerId: g.current.ownerId,
      ownerName: g.owner?.name || "Unassigned",
      deadline: g.current.deadline,
      estimated: g.current.estimated,
      status: g.current.status,
      externalParty: g.current.externalParty,
      paused: g.status === "On Hold" || !!g.cycle?.paused,
      demo: g.demo,
      intervalDays: null,
    }));
  for (const task of db
    .select()
    .from(tasks)
    .where(isNull(tasks.completedAt))
    .all()) {
    const grant = grants.find((g) => g.id === task.grantId);
    if (!grant) continue;
    items.push({
      id: task.id,
      grantId: grant.id,
      grantName: grant.name,
      name: task.name,
      kind: "Reporting",
      programId: grant.programId,
      ownerId: task.ownerId,
      ownerName: users.find((u) => u.id === task.ownerId)?.name || "Unassigned",
      deadline: task.deadline,
      estimated: false,
      status: "Not Started",
      externalParty: null,
      paused: grant.status === "On Hold" || !!grant.cycle?.paused,
      demo: grant.demo,
      intervalDays: task.intervalDays,
    });
  }
  return items
    .filter((item) => !ownerId || item.ownerId === ownerId)
    .sort(
      (a, b) =>
        (a.deadline || "9999").localeCompare(b.deadline || "9999") ||
        a.name.localeCompare(b.name),
    );
}
