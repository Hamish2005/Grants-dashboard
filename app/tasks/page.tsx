import { currentUser } from "@/lib/auth";
import { listWorkItems } from "@/lib/work-queue";
import { WorkQueue } from "@/components/work-queue";
import { today } from "@/lib/utils";
export default async function Page() {
  const user = await currentUser();
  return (
    <WorkQueue
      key="tasks"
      mode="tasks"
      items={listWorkItems(user.id)}
      userId={user.id}
      role={user.role}
      day={today()}
    />
  );
}
