import { currentUser } from "@/lib/auth";
import { listGrants, referenceData } from "@/lib/grants";
import { NewGrant } from "@/components/new-grant";
export default async function Page() {
  const user = await currentUser();
  return (
    <NewGrant
      refs={referenceData()}
      userId={user.id}
      grants={listGrants()}
      initialTab="bulk"
    />
  );
}
