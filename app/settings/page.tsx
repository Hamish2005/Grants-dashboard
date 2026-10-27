import { currentUser } from "@/lib/auth";
import { referenceData, listGrants } from "@/lib/grants";
import Link from "next/link";
import { ActionButton } from "@/components/forms";
import { PageHeading, Badge } from "@/components/common";
export default async function Page() {
  const user = await currentUser();
  return (
    <>
      <PageHeading
        title="Workspace settings"
        description="Access, storage, and planning context for your internal workspace."
      />
      <div className="template-grid">
        {user.role !== "Staff" && (
          <section className="panel panel-body">
            <h2>Archived grants</h2>
            <p className="help">
              Archiving removes a grant from the tracker while retaining its
              history. Restore it here.
            </p>
            {listGrants(true)
              .filter((g) => g.archived)
              .map((g) => (
                <div className="document-row" key={g.id}>
                  <Link href={`/grants/${g.id}`}>{g.name}</Link>
                  <ActionButton
                    body={{ action: "archive", id: g.id, archived: false }}
                  >
                    Restore
                  </ActionButton>
                </div>
              ))}
          </section>
        )}
        <section className="panel panel-body settings-list">
          <h2>Access & security</h2>
          <Badge
            tone={process.env.AUTH_MODE === "development" ? "amber" : "green"}
          >
            {process.env.AUTH_MODE === "development"
              ? "Development authentication"
              : "Identity gateway authentication"}
          </Badge>
          <div>
            <h3>Signed in as {user.name}</h3>
            <p>
              {user.role}. All approved staff can read internal grant records,
              comments, and documents. Staff can edit grants they manage or
              currently coordinate. Managers maintain grant details and cycle
              holds. Admins also maintain templates.
            </p>
          </div>
          <div>
            <h3>Production deployment</h3>
            <p>
              Development authentication is rejected when NODE_ENV=production.
              Connect a trusted Microsoft Entra ID gateway using short-lived
              signed tokens, provision real staff accounts, and restrict direct
              server access. See README for the deployment checklist.
            </p>
          </div>
          <div>
            <h3>Private document storage</h3>
            <p>
              Files are stored outside public directories and downloaded only
              after authentication. No uploaded content is sent to AI services.
              Do not ingest personal-level HMIS or client records.
            </p>
          </div>
        </section>
        <section className="panel panel-body settings-list">
          <h2>Planning conventions</h2>
          <div>
            <h3>Pacific Time</h3>
            <p>
              RTFH deadlines use America/Los_Angeles. Date-only fields preserve
              their calendar date. Audit events store UTC timestamps and display
              Pacific Time.
            </p>
          </div>
          <div>
            <h3>Estimates, not requirements</h3>
            <p>
              Template durations are editable guidance. No stage advances
              automatically because a deadline passes. Recurring reporting tasks
              must reflect the actual agreement.
            </p>
          </div>
          <div>
            <h3>Official context</h3>
            <p>
              <a
                href="https://www.rtfhsd.org/wp-content/uploads/2026/08/HHAP-RFP_Final_August-2026.pdf"
                target="_blank"
                rel="noreferrer"
              >
                August 2026 HHAP RFP ↗
              </a>
              <br />
              <a
                href="https://www.rtfhsd.org/funding/grants-recipients/"
                target="_blank"
                rel="noreferrer"
              >
                RTFH Grants & Contracts ↗
              </a>
              <br />
              <a
                href="https://www.rtfhsd.org/about-coc/coc-monitoring/"
                target="_blank"
                rel="noreferrer"
              >
                CoC Monitoring ↗
              </a>
            </p>
            <p>
              The supplied FY 2026 CoC timeline link could not be retrieved
              during implementation. CoC planning defaults are sourced from the
              project brief and require staff verification.
            </p>
          </div>
        </section>
        <section className="panel panel-body">
          <h2>Provisioned accounts</h2>
          <p className="help">
            Seed accounts are fictional. Account provisioning is an operator
            task; the browser cannot promote users or switch identities.
          </p>
          {referenceData().users.map((u) => (
            <div className="document-row" key={u.id}>
              <strong>{u.name}</strong>
              <span>{u.email}</span>
              <Badge>{u.role}</Badge>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
