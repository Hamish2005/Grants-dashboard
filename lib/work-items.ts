import { addDays } from "./utils";
export type WorkItem = {
  id: string;
  grantId: string;
  grantName: string;
  name: string;
  kind: "Stage" | "Reporting";
  programId: string;
  ownerId: string;
  ownerName: string;
  deadline: string | null;
  estimated: boolean;
  status: string;
  externalParty: string | null;
  paused: boolean;
  demo: boolean;
  intervalDays: number | null;
};
export function matchesWorkView(item: WorkItem, view: string, day: string) {
  if (view === "all") return true;
  if (view === "paused") return item.paused;
  if (item.paused) return false;
  if (view === "blocked") return item.status === "Blocked";
  if (view === "waiting") return !!item.externalParty;
  if (view === "unscheduled") return !item.deadline;
  if (!item.deadline) return false;
  if (view === "overdue") return item.deadline < day;
  if (view === "upcoming") return item.deadline >= day;
  if (view === "week" || view === "month")
    return (
      item.deadline >= day &&
      item.deadline <= addDays(day, view === "week" ? 7 : 30)
    );
  return false;
}
