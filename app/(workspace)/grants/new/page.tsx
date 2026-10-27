import { requireUser } from "@/lib/require-user";
import { listGrants, referenceData } from "@/lib/grants";
import { NewGrant } from "@/components/new-grant";
export default async function Page() {
  const user = await requireUser();
  return (
    <NewGrant
      refs={await referenceData()}
      userId={user.id}
      grants={await listGrants()}
    />
  );
}
