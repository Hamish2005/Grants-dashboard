import { requireUser } from "@/lib/require-user";
import { listWorkItems } from "@/lib/work-queue";
import { WorkQueue } from "@/components/work-queue";
import { today } from "@/lib/utils";
export default async function Page() {
  const user = await requireUser();
  return (
    <WorkQueue
      key="deadlines"
      mode="deadlines"
      items={await listWorkItems()}
      userId={user.id}
      role={user.role}
      day={today()}
    />
  );
}
