import { currentUser } from "@/lib/auth";
import { referenceData } from "@/lib/grants";
import { Templates } from "@/components/templates";
export default async function Page() {
  const user = await currentUser();
  return <Templates refs={referenceData()} admin={user.role === "Admin"} />;
}
