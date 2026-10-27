import { currentUser } from "@/lib/auth";
import { listGrants, referenceData } from "@/lib/grants";
import { Tracker } from "@/components/tracker";
export default async function Page() {
  const user = await currentUser();
  return (
    <Tracker
      grants={listGrants()}
      users={referenceData().users}
      userId={user.id}
    />
  );
}
