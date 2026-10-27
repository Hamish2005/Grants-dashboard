import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { listGrants, referenceData } from "@/lib/grants";
import { PageHeading, Badge } from "@/components/common";
import { ActionButton } from "@/components/forms";
import { money } from "@/lib/utils";
export default async function Page() {
  const user = await currentUser();
  const grants = listGrants();
  return (
    <>
      <PageHeading
        title="Funding cycles"
        description="Coordinate the portfolio while keeping each grant’s lifecycle separate."
      />
      <div className="template-grid">
        {referenceData().cycles.map((c) => {
          const group = grants.filter((g) => g.cycleId === c.id);
          return (
            <section className="panel template-card" key={c.id}>
              <Badge tone={c.paused ? "amber" : "green"}>
                {c.paused ? "On Hold" : "Active"}
              </Badge>
              <h2 style={{ marginTop: 14 }}>{c.name}</h2>
              <p>
                {c.programId} · {group.length} grants ·{" "}
                {money(group.reduce((sum, g) => sum + (g.awarded || 0), 0))}{" "}
                recorded awards
              </p>
              {group.map((g) => (
                <Link
                  className="document-row"
                  key={g.id}
                  href={`/grants/${g.id}`}
                >
                  {g.name}
                  <span style={{ marginLeft: "auto" }}>{g.current.name}</span>
                </Link>
              ))}
              {user.role !== "Staff" && (
                <div className="form-actions">
                  <ActionButton
                    body={{ action: "cycle", id: c.id, paused: !c.paused }}
                  >
                    {c.paused ? "Resume cycle" : "Put cycle on hold"}
                  </ActionButton>
                </div>
              )}
              <p>
                Pausing prevents stage changes and handoffs. Dates are preserved
                until explicitly revised.
              </p>
            </section>
          );
        })}
      </div>
    </>
  );
}
