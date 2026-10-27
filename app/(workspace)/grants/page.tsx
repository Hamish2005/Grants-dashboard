import { requireUser } from "@/lib/require-user";
import { listGrants, referenceData } from "@/lib/grants";
import { Tracker } from "@/components/tracker";
export default async function Page() {
  const user = await requireUser();
  return (
    <Tracker
      mode="grants"
      grants={await listGrants()}
      users={(await referenceData()).users}
      userId={user.id}
    />
  );
}
