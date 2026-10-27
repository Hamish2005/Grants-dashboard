import { currentUser } from "@/lib/auth";
import { listGrants } from "@/lib/grants";
import { csvCell } from "@/lib/imports";
export async function GET() {
  await currentUser();
  const fields = [
    "Grant name",
    "Funding program",
    "Organization",
    "Grant ID",
    "Funding requested",
    "Funding awarded",
    "Current stage",
    "Stage owner",
    "Deadline",
    "Status",
  ];
  const rows = listGrants().map((g) => [
    g.name,
    g.programId,
    g.organization,
    g.externalId,
    g.requested == null ? "" : g.requested / 100,
    g.awarded == null ? "" : g.awarded / 100,
    g.current.name,
    g.owner?.name,
    g.current.deadline,
    g.status,
  ]);
  return new Response(
    [fields, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n"),
    {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="grants.csv"',
        "Cache-Control": "no-store",
      },
    },
  );
}
