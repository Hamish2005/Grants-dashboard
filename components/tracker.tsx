"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownUp,
  ArrowRight,
  Search,
  SlidersHorizontal,
  LayoutList,
  Columns3,
  Clock3,
  CircleAlert,
  FolderOpen,
  CircleCheck,
  Ban,
  Plus,
  Download,
} from "lucide-react";
import { Button } from "./ui/button";
import { Badge, Status, PageHeading, DemoNotice, Empty } from "./common";
import { addDays, dateLabel, today } from "@/lib/utils";
import type { listGrants, referenceData } from "@/lib/grants";
export type GrantRow = Awaited<ReturnType<typeof listGrants>>[number];
export type References = Awaited<ReturnType<typeof referenceData>>;
export function Tracker({
  grants,
  users,
  userId,
  mode = "overview",
}: {
  grants: GrantRow[];
  users: References["users"];
  userId: string;
  mode?: string;
}) {
  const [query, setQuery] = useState("");
  const [program, setProgram] = useState("");
  const [stage, setStage] = useState("");
  const [owner, setOwner] = useState("");
  const [status, setStatus] = useState("");
  const [tab, setTab] = useState(
    mode === "tasks" ? "mine" : mode === "deadlines" ? "deadlines" : "all",
  );
  const [sort, setSort] = useState("deadline");
  const [kanban, setKanban] = useState(false);
  const [filters, setFilters] = useState(false);
  const router = useRouter();
  const day = today();
  const active = (g: GrantRow) => g.status === "Active" && !g.cycle?.paused;
  const overdue = (g: GrantRow) =>
    active(g) && !!g.current.deadline && g.current.deadline < day;
  const upcoming = (g: GrantRow) =>
    active(g) &&
    !!g.current.deadline &&
    g.current.deadline >= day &&
    g.current.deadline <= addDays(day, 7);
  const attention = (g: GrantRow) =>
    overdue(g) || g.current.status === "Blocked";
  const filtered = grants
    .filter(
      (g) =>
        (!query ||
          `${g.name} ${g.organization || ""} ${g.externalId || ""}`
            .toLowerCase()
            .includes(query.toLowerCase())) &&
        (!program || g.programId === program) &&
        (!stage || g.current.name === stage) &&
        (!owner || g.current.ownerId === owner) &&
        (!status || g.current.status === status || g.status === status) &&
        (tab === "all" ||
          (tab === "mine" &&
            g.current.ownerId === userId &&
            g.status === "Active") ||
          (tab === "attention" && attention(g)) ||
          (tab === "deadlines" && upcoming(g)) ||
          (tab === "waiting" && !!g.current.externalParty && active(g))),
    )
    .sort((a, b) =>
      sort === "updated"
        ? b.updatedAt.localeCompare(a.updatedAt)
        : (a.current.deadline || "9999").localeCompare(
            b.current.deadline || "9999",
          ),
    );
  const stats = [
    [
      "Total grants",
      grants.length,
      FolderOpen,
      "Across all funding programs",
      "neutral",
    ],
    [
      "Active grants",
      grants.filter(active).length,
      CircleCheck,
      "Moving through the lifecycle",
      "blue",
    ],
    [
      "Due in 7 days",
      grants.filter(upcoming).length,
      Clock3,
      "Upcoming stage deadlines",
      "amber",
    ],
    [
      "Overdue grants",
      grants.filter(overdue).length,
      CircleAlert,
      "Need a deadline review",
      "red",
    ],
    [
      "Currently blocked",
      grants.filter(
        (g) => g.current.status === "Blocked" && g.status === "Active",
      ).length,
      Ban,
      "Waiting on a resolution",
      "red",
    ],
  ] as const;
  return (
    <>
      <PageHeading
        eyebrow="GRANTS & CONTRACTS"
        title={
          mode === "overview"
            ? "A clear view of every grant."
            : mode === "tasks"
              ? "My tasks"
              : mode === "deadlines"
                ? "Upcoming deadlines"
                : "All grants"
        }
        description={
          mode === "overview"
            ? "Track progress, coordinate handoffs, and keep funding moving."
            : "Your grant portfolio, from application to closeout."
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <a href="/api/export">
                <Download size={16} />
                Export
              </a>
            </Button>
            <Button asChild>
              <Link href="/grants/new">
                <Plus size={17} />
                New grant
              </Link>
            </Button>
          </>
        }
      />
      {grants.some((g) => g.demo) && <DemoNotice />}
      {mode === "overview" && (
        <div className="stats-grid">
          {stats.map(([label, value, Icon, note, tone], i) => (
            <button
              className={`stat-card stat-${tone}`}
              key={label}
              onClick={() =>
                setTab(i === 2 ? "deadlines" : i > 2 ? "attention" : "all")
              }
            >
              <div className="stat-top">
                {label}
                <Icon size={18} />
              </div>
              <div className="stat-number">
                {value.toString().padStart(2, "0")}
              </div>
              <div className="stat-note">{note}</div>
            </button>
          ))}
        </div>
      )}
      <section className="panel tracker-panel">
        <div className="section-heading">
          <div>
            <h2>
              Grants tracker <span className="count">{grants.length}</span>
            </h2>
            <p>The next step, the right owner, all in one place.</p>
          </div>
          <div className="view-switch">
            <button
              aria-label="Table view"
              className={!kanban ? "active" : ""}
              onClick={() => setKanban(false)}
            >
              <LayoutList size={17} />
            </button>
            <button
              aria-label="Kanban view"
              className={kanban ? "active" : ""}
              onClick={() => setKanban(true)}
            >
              <Columns3 size={17} />
            </button>
          </div>
        </div>
        <div className="tracker-tabs">
          {[
            ["all", "All grants"],
            ["mine", "My tasks"],
            ["deadlines", "Due in 7 days"],
            ["attention", "Needs attention"],
            ["waiting", "External decisions"],
          ].map(([value, label]) => (
            <button
              key={value}
              className={tab === value ? "active" : ""}
              onClick={() => setTab(value)}
            >
              {label}
              {value === "attention" && (
                <span>{grants.filter(attention).length}</span>
              )}
            </button>
          ))}
        </div>
        <div className="toolbar">
          <div className="search-input">
            <Search size={17} />
            <input
              aria-label="Search grants"
              placeholder="Search grants, organizations, or IDs…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            aria-label="Funding program filter"
            value={program}
            onChange={(e) => setProgram(e.target.value)}
          >
            <option value="">All programs</option>
            {["HHAP", "CoC", "YHDP", "Other"].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
          <Button variant="outline" onClick={() => setFilters(!filters)}>
            <SlidersHorizontal size={15} />
            Filters
            {[stage, owner, status].filter(Boolean).length
              ? ` (${[stage, owner, status].filter(Boolean).length})`
              : ""}
          </Button>
          <label className="sort-select">
            <ArrowDownUp size={15} />
            <select
              aria-label="Sort grants"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="deadline">Deadline</option>
              <option value="updated">Recently updated</option>
            </select>
          </label>
        </div>
        {filters && (
          <div className="filter-row">
            <select
              aria-label="Stage filter"
              value={stage}
              onChange={(e) => setStage(e.target.value)}
            >
              <option value="">All stages</option>
              {[...new Set(grants.map((g) => g.current.name))].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select
              aria-label="Owner filter"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
            >
              <option value="">All owners</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Status filter"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All statuses</option>
              {[
                "In Progress",
                "Blocked",
                "On Hold",
                "Closed",
                "Not Selected",
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <Button
              variant="ghost"
              onClick={() => {
                setStage("");
                setOwner("");
                setStatus("");
                setProgram("");
                setQuery("");
                setTab("all");
              }}
            >
              Clear filters
            </Button>
          </div>
        )}
        {!filtered.length ? (
          <Empty
            title="No grants match this view"
            detail="Try another filter, or add your first grant."
          />
        ) : kanban ? (
          <div className="kanban">
            {[...new Set(filtered.map((g) => g.current.name))].map((stage) => (
              <div className="kanban-column" key={stage}>
                <h3>
                  {stage}
                  <span>
                    {filtered.filter((g) => g.current.name === stage).length}
                  </span>
                </h3>
                {filtered
                  .filter((g) => g.current.name === stage)
                  .map((g) => (
                    <Link
                      href={`/grants/${g.id}`}
                      className="kanban-card"
                      key={g.id}
                    >
                      <Badge tone="blue">{g.programId}</Badge>
                      <h4>{g.name}</h4>
                      <p>{g.organization || "Organization not recorded"}</p>
                      <Status value={g.current.status} />
                      <div className="kanban-meta">
                        {g.owner?.name}
                        <span>{dateLabel(g.current.deadline)}</span>
                      </div>
                    </Link>
                  ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="table-scroll">
            <table className="grants-table">
              <thead>
                <tr>
                  <th>Grant / organization</th>
                  <th>Program</th>
                  <th>Current stage</th>
                  <th>Stage owner</th>
                  <th>Deadline ↓</th>
                  <th>Status</th>
                  <th>Latest update</th>
                  <th>Next stage</th>
                  <th>Next owner</th>
                  <th>Target date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((g) => (
                  <tr key={g.id} onClick={() => router.push(`/grants/${g.id}`)}>
                    <td>
                      <Link className="grant-name" href={`/grants/${g.id}`}>
                        {g.name}
                      </Link>
                      <small>
                        {g.organization || "Organization not recorded"}
                      </small>
                    </td>
                    <td>
                      <span
                        className={`program program-${g.programId.toLowerCase()}`}
                      >
                        {g.programId}
                      </span>
                    </td>
                    <td>
                      <span className="stage-label">{g.current.name}</span>
                      <small>
                        Stage {g.currentPosition + 1} of {g.stages.length}
                      </small>
                    </td>
                    <td>
                      <span className="owner-cell">
                        <span
                          className={`avatar avatar-small color-${g.current.ownerId.length % 3}`}
                        >
                          {g.owner?.name
                            .split(" ")
                            .map((x) => x[0])
                            .join("")}
                        </span>
                        {g.owner?.name}
                      </span>
                    </td>
                    <td>
                      <span className={overdue(g) ? "deadline-overdue" : ""}>
                        {dateLabel(g.current.deadline)}
                      </span>
                      <small>
                        {g.current.deadline
                          ? (overdue(g) ? "Overdue · " : "") +
                            (g.current.estimated ? "Estimated" : "Confirmed")
                          : "Awaiting schedule"}
                      </small>
                    </td>
                    <td>
                      <Status
                        value={
                          g.cycle?.paused
                            ? "On Hold"
                            : g.status !== "Active"
                              ? g.status
                              : g.current.status
                        }
                      />
                    </td>
                    <td className="latest-comment">
                      {g.latest?.text || "No updates yet"}
                    </td>
                    <td>{g.next?.name || "—"}</td>
                    <td>{g.nextOwner?.name || "—"}</td>
                    <td>
                      {dateLabel(g.next?.deadline)}
                      {g.next?.deadline && (
                        <small>
                          {g.next.estimated ? "Estimated" : "Confirmed"}
                        </small>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="table-footer">
          <span>
            Showing {filtered.length} of {grants.length} grants
          </span>
          <span>
            <span className="tiny-dot" />
            Saved to the workspace database
          </span>
        </div>
      </section>
      {mode === "overview" && (
        <div className="overview-bottom">
          <section className="panel attention-panel">
            <div className="section-heading">
              <h2>
                <CircleAlert size={17} />
                On your radar
              </h2>
              <button className="text-link" onClick={() => setTab("attention")}>
                View all <ArrowRight size={14} />
              </button>
            </div>
            {grants
              .filter(attention)
              .slice(0, 3)
              .map((g) => (
                <Link
                  className="radar-item"
                  href={`/grants/${g.id}`}
                  key={g.id}
                >
                  <span className="radar-icon">
                    <Clock3 size={17} />
                  </span>
                  <div>
                    <strong>{g.name}</strong>
                    <small>
                      {g.current.status === "Blocked"
                        ? "Blocked · Needs a resolution"
                        : `Deadline passed · ${g.current.name}`}
                    </small>
                  </div>
                  <ArrowRight size={16} />
                </Link>
              ))}
            {!grants.some(attention) && (
              <Empty title="All clear" detail="No overdue or blocked stages." />
            )}
          </section>
          <section className="panel workflow-note">
            <span className="eyebrow">BUILT FOR THE HANDOFF</span>
            <h2>
              Less tracking.
              <br />
              More moving forward.
            </h2>
            <p>
              Complete a stage to activate the next step, carry forward
              ownership, and propose its timeline.
            </p>
            <Link href="/templates" className="text-link">
              Explore your workflows <ArrowRight size={15} />
            </Link>
          </section>
        </div>
      )}
    </>
  );
}
