import { requireUser } from "@/lib/require-user";
import { Shell } from "@/components/shell";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return (
    <Shell
      name={user.name}
      role={user.role}
      canSignOut={process.env.AUTH_MODE === "entra"}
    >
      {children}
    </Shell>
  );
}
