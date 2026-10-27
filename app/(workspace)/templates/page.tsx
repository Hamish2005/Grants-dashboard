import { requireUser } from "@/lib/require-user";
import { referenceData } from "@/lib/grants";
import { Templates } from "@/components/templates";
export default async function Page() {
  const user = await requireUser();
  return (
    <Templates refs={await referenceData()} admin={user.role === "Admin"} />
  );
}
