"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  ExternalLink,
  Paperclip,
  MessageSquare,
  History,
  CalendarDays,
  Pause,
  Play,
  Pencil,
} from "lucide-react";
import { Button } from "./ui/button";
import { Field, apiAction, ActionButton } from "./forms";
import { Status, PageHeading, DemoNotice, Badge } from "./common";
import { dateLabel, money } from "@/lib/utils";
import type { getGrant } from "@/lib/grants";
import type { References } from "./tracker";
import type * as s from "@/lib/db/schema";
import type { Actor } from "@/lib/auth";
type Props = {
  grant: Awaited<ReturnType<typeof getGrant>>;
  refs: References;
  user: Actor;
  comments: (typeof s.comments.$inferSelect)[];
  documents: (typeof s.documents.$inferSelect)[];
  audit: (typeof s.auditLogs.$inferSelect)[];
  tasks: (typeof s.tasks.$inferSelect)[];
};
function timestamp(value: string) {
  return (
    new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/Los_Angeles",
    }).format(new Date(value)) + " PT"
  );
}
export function GrantDetail({
  grant: g,
  refs,
  user,
  comments,
  documents,
  audit,
  tasks,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState("stage");
  const [thread, setThread] = useState(g.current.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [edit, setEdit] = useState(false);
  const [decision, setDecision] = useState("");
  const [appeals, setAppeals] = useState("");
  const [skipReason, setSkipReason] = useState("");
  const [showAdvance, setShowAdvance] = useState(false);
  const cycle = refs.cycles.find((c) => c.id === g.cycleId);
  const manager = refs.users.find((u) => u.id === g.managerId);
  const canEdit =
    user.role !== "Staff" ||
    g.managerId === user.id ||
    g.current.ownerId === user.id;
  const active = g.status === "Active" && !cycle?.paused && !g.archived;
  const actorName = (id: string) =>
    refs.users.find((u) => u.id === id)?.name || "Staff";
  async function run(body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await apiAction({ ...body, id: g.id, expectedStageId: g.current.id });
      if (body.action === "advance") {
        setShowAdvance(false);
        setAppeals("");
        setDecision("");
      }
      setSuccess("Saved to the workspace.");
      router.refresh();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link className="back-link" href="/grants">
        <ArrowLeft size={14} />
        All grants
      </Link>
      <PageHeading
        title={g.name}
        description={`${g.organization || "Organization not recorded"} · ${g.externalId || "No external grant ID"}`}
        actions={
          <>
            {user.role !== "Staff" && (
              <Button variant="outline" onClick={() => setEdit(!edit)}>
                <Pencil size={14} />
                {edit ? "Close editor" : "Edit details"}
              </Button>
            )}
            {user.role !== "Staff" &&
              ["Active", "On Hold"].includes(g.status) && (
                <ActionButton
                  body={{
                    action: "hold",
                    id: g.id,
                    hold: g.status !== "On Hold",
                  }}
                >
                  {g.status === "On Hold" ? (
                    <Play size={14} />
                  ) : (
                    <Pause size={14} />
                  )}{" "}
                  {g.status === "On Hold" ? "Resume" : "Put on hold"}
                </ActionButton>
              )}
          </>
        }
      />
      {g.demo && <DemoNotice />}
      {g.archived && (
        <div className="help">
          This grant is archived and hidden from the tracker. Its records,
          documents, and audit history are retained.
        </div>
      )}
      {cycle?.paused && (
        <div className="help">
          This funding cycle is paused. Stage transitions are disabled until a
          Manager or Admin resumes it.
        </div>
      )}
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {success && (
        <div className="success" role="status">
          {success}
        </div>
      )}
      <section className="panel detail-summary">
        <div>
          <small>Funding program / cycle</small>
          <strong>
            {g.programId} · {cycle?.name || "No cycle assigned"}
          </strong>
        </div>
        <div>
          <small>Funding requested</small>
          <strong>{money(g.requested)}</strong>
        </div>
        <div>
          <small>Funding awarded</small>
          <strong>{money(g.awarded)}</strong>
        </div>
        <div>
          <small>Internal grant manager</small>
          <strong>{manager?.name}</strong>
        </div>
        <div>
          <small>Agreement dates</small>
          <strong>
            {dateLabel(g.startDate)} — {dateLabel(g.endDate)}
          </strong>
        </div>
        <div>
          <small>Current deadline</small>
          <strong>{dateLabel(g.current.deadline)}</strong>{" "}
          {g.current.deadline && (
            <Badge>{g.current.estimated ? "Estimated" : "Confirmed"}</Badge>
          )}
        </div>
        <div>
          <small>Next stage</small>
          <strong>{g.next?.name || "No remaining stage"}</strong>
        </div>
        <div>
          <small>Overall status</small>
          <Status value={cycle?.paused ? "On Hold" : g.status} />
        </div>
      </section>
      {edit && (
        <form
          className="panel form-panel"
          style={{ marginTop: 20, maxWidth: "none" }}
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const values = Object.fromEntries(form);
            if (
              await run({
                action: "updateGrant",
                ...values,
                requested: form.get("requested")
                  ? Math.round(Number(form.get("requested")) * 100)
                  : null,
                awarded: form.get("awarded")
                  ? Math.round(Number(form.get("awarded")) * 100)
                  : null,
              })
            )
              setEdit(false);
          }}
        >
          <h2>Edit grant details</h2>
          <div className="form-grid" style={{ marginTop: 20 }}>
            <Field label="Grant name">
              <input name="name" required defaultValue={g.name} />
            </Field>
            <Field label="Organization">
              <input name="organization" defaultValue={g.organization || ""} />
            </Field>
            <Field label="External grant ID">
              <input name="externalId" defaultValue={g.externalId || ""} />
            </Field>
            <Field label="Program">
              <select name="programId" defaultValue={g.programId}>
                {["HHAP", "CoC", "YHDP", "Other"].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </Field>
            <Field label="Funding cycle">
              <select name="cycleId" defaultValue={g.cycleId || ""}>
                <option value="">None</option>
                {refs.cycles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Grant manager">
              <select name="managerId" defaultValue={g.managerId}>
                {refs.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </Field>
            {(["requested", "awarded"] as const).map((f) => (
              <Field key={f} label={`Funding ${f} (USD)`}>
                <input
                  type="number"
                  name={f}
                  min="0"
                  step=".01"
                  defaultValue={g[f] == null ? "" : g[f] / 100}
                />
              </Field>
            ))}
            {(["startDate", "endDate", "applicationDeadline"] as const).map(
              (f) => (
                <Field
                  key={f}
                  label={
                    f === "startDate"
                      ? "Contract start"
                      : f === "endDate"
                        ? "Contract end"
                        : "Application deadline"
                  }
                >
                  <input type="date" name={f} defaultValue={g[f] || ""} />
                </Field>
              ),
            )}
            <Field label="Reporting requirements">
              <textarea name="reporting" defaultValue={g.reporting || ""} />
            </Field>
            <Field label="Important milestones">
              <textarea name="milestones" defaultValue={g.milestones || ""} />
            </Field>
          </div>
          <div className="form-actions">
            <Button disabled={busy}>Save details</Button>
          </div>
        </form>
      )}
      <div className="panel workflow-strip" aria-label="Grant lifecycle">
        {g.stages.map((stage, i) => (
          <button
            key={stage.id}
            onClick={() => {
              setThread(stage.id);
              setTab("comments");
            }}
            className={`workflow-step ${stage.position === g.currentPosition ? "current" : ""} ${stage.status === "Completed" ? "complete" : ""}`}
            style={{ background: "none", border: 0, textAlign: "left" }}
          >
            <span className="step-circle">
              {stage.status === "Completed" ? <Check size={13} /> : i + 1}
            </span>
            <strong>{stage.name}</strong>
            <small>{stage.status}</small>
          </button>
        ))}
      </div>
      <div className="detail-tabs">
        {[
          ["stage", "Current stage"],
          ["comments", `Comments (${comments.length})`],
          ["documents", `Documents (${documents.length})`],
          ["tasks", "Reporting tasks"],
          ["history", "Audit history"],
        ].map(([value, label]) => (
          <button
            key={value}
            className={tab === value ? "active" : ""}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="detail-columns">
        <section className="panel panel-body">
          {tab === "stage" && (
            <>
              <div className="stage-heading">
                <div>
                  <div className="eyebrow">
                    STAGE {g.currentPosition + 1} OF {g.stages.length}
                  </div>
                  <h2>{g.current.name}</h2>
                </div>
                <Status value={g.current.status} />
              </div>
              <p className="section-subtitle">{g.current.description}</p>
              {g.current.externalParty && (
                <div className="help">
                  <strong>
                    External responsibility: {g.current.externalParty}
                  </strong>
                  <br />
                  The internal owner coordinates this stage. Independent scoring
                  and external decisions remain with the responsible committee
                  or agency.
                </div>
              )}
              <form
                key={g.current.id + g.current.updatedAt}
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  await run({
                    action: "stage",
                    ...Object.fromEntries(f),
                    duration: f.get("duration")
                      ? Number(f.get("duration"))
                      : null,
                    estimated: f.get("estimated") === "on",
                    recalculate: f.get("recalculate") === "on",
                  });
                }}
              >
                <div className="form-grid">
                  <Field label="Stage coordinator">
                    <select name="ownerId" defaultValue={g.current.ownerId}>
                      {refs.users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Status">
                    <select name="status" defaultValue={g.current.status}>
                      <option>In Progress</option>
                      <option>Blocked</option>
                    </select>
                  </Field>
                  <Field label="Default responsible role">
                    <input disabled value={g.current.role} />
                  </Field>
                  <Field label="External responsible party">
                    <input
                      name="externalParty"
                      defaultValue={g.current.externalParty || ""}
                    />
                  </Field>
                  <Field label="Planned start">
                    <input
                      type="date"
                      name="plannedStart"
                      defaultValue={g.current.plannedStart || ""}
                    />
                  </Field>
                  <Field label="Stage deadline">
                    <input
                      type="date"
                      name="deadline"
                      defaultValue={g.current.deadline || ""}
                    />
                  </Field>
                  <Field label="Planning duration (calendar days)">
                    <input
                      type="number"
                      min="0"
                      max="3650"
                      name="duration"
                      defaultValue={g.current.duration ?? ""}
                    />
                  </Field>
                  <Field label="Actual start">
                    <input
                      disabled
                      value={
                        g.current.actualStart
                          ? timestamp(g.current.actualStart)
                          : "Not recorded"
                      }
                    />
                  </Field>
                </div>
                <label className="check-label">
                  <input
                    type="checkbox"
                    name="estimated"
                    defaultChecked={g.current.estimated}
                  />
                  This is an estimated date, not a confirmed deadline.
                </label>
                <label className="check-label">
                  <input type="checkbox" name="recalculate" />
                  Recalculate future estimated dates after saving. Confirmed and
                  historical dates are preserved.
                </label>
                <div className="form-actions">
                  <Button
                    disabled={busy || !active || !canEdit}
                    variant="outline"
                  >
                    Save stage changes
                  </Button>
                </div>
              </form>
              <hr className="form-divider" />
              <h3>Ready for the next step?</h3>
              <p className="section-subtitle" style={{ marginTop: 6 }}>
                Completion records the handoff and activates the next applicable
                stage.
              </p>
              {!showAdvance ? (
                <Button
                  disabled={
                    !active || !canEdit || g.current.status === "Blocked"
                  }
                  onClick={() => setShowAdvance(true)}
                >
                  Complete & advance
                  <ArrowRight size={14} />
                </Button>
              ) : (
                <div>
                  {g.current.decision && (
                    <Field label="Funding decision *">
                      <select
                        value={decision}
                        onChange={(e) => setDecision(e.target.value)}
                      >
                        <option value="">Choose a decision</option>
                        <option value="Selected">Selected — proceed</option>
                        <option value="Not Selected">
                          Not selected — end workflow
                        </option>
                      </select>
                    </Field>
                  )}
                  {g.next?.optional && (
                    <Field label="Is an appeal required? *">
                      <select
                        value={appeals}
                        onChange={(e) => setAppeals(e.target.value)}
                      >
                        <option value="">Choose</option>
                        <option value="yes">Yes — activate appeals</option>
                        <option value="no">
                          No — skip appeals with recorded reason
                        </option>
                      </select>
                    </Field>
                  )}
                  <div className="form-actions">
                    <Button
                      disabled={busy}
                      onClick={() =>
                        void run({
                          action: "advance",
                          ...(decision ? { decision } : {}),
                          ...(appeals ? { appeals: appeals === "yes" } : {}),
                        })
                      }
                    >
                      Confirm completion
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setShowAdvance(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
              {g.current.optional && active && canEdit && (
                <div style={{ marginTop: 24 }}>
                  <Field label="Skip this optional stage — reason required">
                    <input
                      value={skipReason}
                      onChange={(e) => setSkipReason(e.target.value)}
                      placeholder="Explain why this stage does not apply"
                    />
                  </Field>
                  <div className="form-actions">
                    <Button
                      disabled={!skipReason.trim() || busy}
                      variant="outline"
                      onClick={() =>
                        void run({
                          action: "advance",
                          skip: true,
                          reason: skipReason,
                        })
                      }
                    >
                      Skip optional stage
                    </Button>
                  </div>
                </div>
              )}
              <p className="muted" style={{ fontSize: 10, marginTop: 22 }}>
                Last updated {timestamp(g.current.updatedAt)} by{" "}
                {actorName(g.current.updatedBy)}.
              </p>
            </>
          )}
          {tab === "comments" && (
            <>
              <h2>Stage conversations</h2>
              <div style={{ marginTop: 18 }}>
                <Field label="Stage">
                  <select
                    value={thread}
                    onChange={(e) => setThread(e.target.value)}
                  >
                    {g.stages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="comments-list">
                {comments
                  .filter((c) => c.stageId === thread)
                  .map((c) => (
                    <div className="comment" key={c.id}>
                      <span className="avatar avatar-small">
                        {actorName(c.authorId)
                          .split(" ")
                          .map((x) => x[0])
                          .join("")}
                      </span>
                      <div className="comment-body">
                        <div className="comment-head">
                          <strong>{actorName(c.authorId)}</strong>
                          <time>{timestamp(c.createdAt)}</time>
                          {c.indicator && (
                            <Badge
                              tone={
                                c.indicator === "Blocker" ? "red" : "neutral"
                              }
                            >
                              {c.indicator}
                            </Badge>
                          )}
                        </div>
                        <p>{c.text}</p>
                        {documents
                          .filter((d) => d.commentId === c.id)
                          .map((d) => (
                            <a
                              className="document-row"
                              key={d.id}
                              href={`/api/documents?id=${d.id}`}
                            >
                              <Paperclip size={13} />
                              {d.name}
                            </a>
                          ))}
                      </div>
                    </div>
                  ))}
                {!comments.some((c) => c.stageId === thread) && (
                  <p className="muted">No comments on this stage yet.</p>
                )}
              </div>
              <form
                className="comment-form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const data = new FormData(form);
                  data.set("grantId", g.id);
                  data.set("stageId", thread);
                  setBusy(true);
                  setError("");
                  try {
                    const response = await fetch("/api/comments", {
                      method: "POST",
                      body: data,
                    });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.error);
                    form.reset();
                    setSuccess("Comment saved.");
                    router.refresh();
                  } catch (error) {
                    setError((error as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <textarea
                  name="text"
                  required
                  maxLength={10000}
                  aria-label="Comment"
                  placeholder="Share an update, decision, or blocker…"
                />
                <Field label="Optional attachment">
                  <input
                    name="file"
                    type="file"
                    accept=".pdf,.docx,.xlsx,.csv"
                  />
                </Field>
                <div className="form-actions">
                  <select aria-label="Comment type" name="indicator">
                    <option>Update</option>
                    <option>Blocker</option>
                    <option>Decision</option>
                  </select>
                  <Button disabled={busy}>Post comment</Button>
                </div>
              </form>
              <p className="help">
                Comments are retained with their original stage. A blocker
                comment is informational; use stage status to block advancement.
                Optional attachments stay linked to their comment and stage.
              </p>
            </>
          )}
          {tab === "documents" && (
            <>
              <h2>Documents & links</h2>
              <p className="section-subtitle" style={{ marginTop: 8 }}>
                Private files and references to your existing document systems.
              </p>
              {documents.map((d) => (
                <div className="document-row" key={d.id}>
                  <FileText size={17} />
                  <a
                    href={d.url || `/api/documents?id=${d.id}`}
                    target={d.url ? "_blank" : undefined}
                    rel="noreferrer"
                  >
                    {d.name}
                    <small style={{ display: "block" }}>
                      {g.stages.find((s) => s.id === d.stageId)?.name ||
                        "Imported grant document"}{" "}
                      · {timestamp(d.createdAt)}
                    </small>
                  </a>
                  {d.url ? <ExternalLink size={13} /> : <Paperclip size={13} />}
                </div>
              ))}
              <hr className="form-divider" />
              <Field label="Attach to stage">
                <select
                  value={thread}
                  onChange={(e) => setThread(e.target.value)}
                >
                  {g.stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <form
                style={{ marginTop: 18 }}
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  setError("");
                  try {
                    const form = new FormData(e.currentTarget);
                    form.set("grantId", g.id);
                    form.set("stageId", thread);
                    const response = await fetch("/api/documents", {
                      method: "POST",
                      body: form,
                    });
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.error);
                    router.refresh();
                    setSuccess("Document uploaded.");
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Field label="Upload PDF, DOCX, XLSX, or CSV (4 MB maximum)">
                  <input
                    type="file"
                    name="file"
                    required
                    accept=".pdf,.docx,.xlsx,.csv"
                  />
                </Field>
                <div className="form-actions">
                  <Button disabled={busy || !canEdit} variant="outline">
                    Upload attachment
                  </Button>
                </div>
              </form>
              <hr className="form-divider" />
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const f = new FormData(form);
                  if (
                    await run({
                      action: "link",
                      stageId: thread,
                      ...Object.fromEntries(f),
                    })
                  )
                    form.reset();
                }}
              >
                <div className="form-grid">
                  <Field label="Document name">
                    <input name="name" required maxLength={200} />
                  </Field>
                  <Field label="HTTPS document URL">
                    <input
                      name="url"
                      type="url"
                      required
                      placeholder="https://…"
                    />
                  </Field>
                </div>
                <div className="form-actions">
                  <Button disabled={busy || !canEdit} variant="outline">
                    Add document link
                  </Button>
                </div>
              </form>
            </>
          )}
          {tab === "tasks" && (
            <>
              <h2>Reporting obligations</h2>
              <p className="help">
                These tasks are separate from lifecycle stages. Configure
                frequency only when supported by the grant agreement. Repeating
                tasks calculate the next due date from the prior deadline.
              </p>
              {tasks.map((t) => (
                <div className="task-row" key={t.id}>
                  <div>
                    <strong>{t.name}</strong>
                    <small>
                      {actorName(t.ownerId)} · {dateLabel(t.deadline)} ·{" "}
                      {t.intervalDays
                        ? `Every ${t.intervalDays} days`
                        : "One time"}
                    </small>
                  </div>
                  {t.completedAt ? (
                    <Badge tone="green">Complete</Badge>
                  ) : (
                    <ActionButton body={{ action: "completeTask", id: t.id }}>
                      Complete
                    </ActionButton>
                  )}
                </div>
              ))}
              <hr className="form-divider" />
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const f = new FormData(form);
                  if (
                    await run({
                      action: "task",
                      ...Object.fromEntries(f),
                      intervalDays: f.get("intervalDays")
                        ? Number(f.get("intervalDays"))
                        : null,
                    })
                  )
                    form.reset();
                }}
              >
                <div className="form-grid">
                  <Field label="Task name">
                    <input
                      name="name"
                      required
                      placeholder="e.g. Performance reporting"
                    />
                  </Field>
                  <Field label="Assigned to">
                    <select name="ownerId" defaultValue={g.managerId}>
                      {refs.users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="First deadline">
                    <input name="deadline" type="date" required />
                  </Field>
                  <Field label="Repeat every N calendar days (optional)">
                    <input type="number" min="1" name="intervalDays" />
                  </Field>
                </div>
                <div className="form-actions">
                  <Button disabled={busy || !canEdit}>
                    Add reporting task
                  </Button>
                </div>
              </form>
            </>
          )}
          {tab === "history" && (
            <>
              <h2>Complete audit trail</h2>
              <p className="section-subtitle" style={{ marginTop: 8 }}>
                Permanent records of changes and handoffs, displayed in Pacific
                Time.
              </p>
              {audit.map((entry) => (
                <div className="history-item" key={entry.id}>
                  <strong>{entry.action}</strong>
                  <small>
                    {actorName(entry.actorId)} · {timestamp(entry.createdAt)}
                  </small>
                  <details>
                    <summary className="text-link">
                      View recorded change
                    </summary>
                    <pre>
                      {JSON.stringify(JSON.parse(entry.details), null, 2)}
                    </pre>
                  </details>
                </div>
              ))}
              <h3 style={{ marginTop: 25 }}>Stage history</h3>
              {g.stages.map((stage) => (
                <div className="history-item" key={stage.id}>
                  <strong>
                    {stage.position + 1}. {stage.name} — {stage.status}
                  </strong>
                  <small>
                    Owner: {actorName(stage.ownerId)} ·{" "}
                    {stage.externalParty || stage.role}
                  </small>
                  <small>
                    Planned: {dateLabel(stage.plannedStart)} →{" "}
                    {dateLabel(stage.deadline)} (
                    {stage.estimated ? "estimated" : "confirmed"})
                  </small>
                  <small>
                    Actual start:{" "}
                    {stage.actualStart
                      ? timestamp(stage.actualStart)
                      : "Not recorded"}{" "}
                    · Completion:{" "}
                    {stage.completedAt
                      ? timestamp(stage.completedAt)
                      : "Not recorded"}
                  </small>
                  {stage.skipReason && (
                    <small>Reason: {stage.skipReason}</small>
                  )}
                  <small>{stage.description}</small>
                  <small>
                    Last update: {timestamp(stage.updatedAt)} by{" "}
                    {actorName(stage.updatedBy)}
                  </small>
                </div>
              ))}
            </>
          )}
        </section>
        <aside>
          <section className="panel panel-body">
            <h2>
              <CalendarDays
                size={16}
                style={{ display: "inline", marginRight: 8 }}
              />
              The next handoff
            </h2>
            {g.next && g.status === "Active" ? (
              <>
                <h3 style={{ marginTop: 20 }}>{g.next.name}</h3>
                <p className="section-subtitle" style={{ marginTop: 9 }}>
                  {actorName(g.next.ownerId)} · {g.next.role}
                </p>
                <div className="help">
                  Target: {dateLabel(g.next.deadline)}
                  <br />
                  {g.next.estimated
                    ? "Editable planning estimate"
                    : "Confirmed deadline"}
                  {g.next.optional && (
                    <>
                      <br />
                      Conditional stage — choose whether it applies when
                      advancing.
                    </>
                  )}
                </div>
              </>
            ) : (
              <p className="section-subtitle" style={{ marginTop: 15 }}>
                {g.status === "On Hold"
                  ? "Resume this grant to continue the workflow."
                  : "No active handoff pending."}
              </p>
            )}
          </section>
          <section className="panel panel-body" style={{ marginTop: 20 }}>
            <h2>
              <MessageSquare
                size={16}
                style={{ display: "inline", marginRight: 8 }}
              />
              Latest update
            </h2>
            {comments[0] ? (
              <div className="comment-body" style={{ marginTop: 18 }}>
                <div className="comment-head">
                  <strong>{actorName(comments[0].authorId)}</strong>
                  <time>{timestamp(comments[0].createdAt)}</time>
                </div>
                <p
                  style={{
                    fontSize: 12,
                    marginTop: 9,
                    color: "#71877f",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {comments[0].text}
                </p>
              </div>
            ) : (
              <p className="muted" style={{ marginTop: 12 }}>
                No updates yet.
              </p>
            )}
            <button
              className="text-link"
              style={{ marginTop: 18 }}
              onClick={() => setTab("comments")}
            >
              View conversations
              <ArrowRight size={13} />
            </button>
          </section>
          <section className="panel panel-body" style={{ marginTop: 20 }}>
            <h2>Agreement notes</h2>
            <h3 style={{ marginTop: 16 }}>Reporting requirements</h3>
            <p
              className="section-subtitle"
              style={{ marginTop: 7, whiteSpace: "pre-wrap" }}
            >
              {g.reporting ||
                "Not recorded. Add obligations from the grant agreement."}
            </p>
            <h3>Important milestones</h3>
            <p
              className="section-subtitle"
              style={{ marginTop: 7, whiteSpace: "pre-wrap" }}
            >
              {g.milestones || "No milestones recorded."}
            </p>
            <button className="text-link" onClick={() => setTab("history")}>
              <History size={14} />
              View change history
            </button>
            {user.role !== "Staff" && (
              <div className="form-actions">
                <ActionButton
                  body={{ action: "archive", id: g.id, archived: !g.archived }}
                >
                  {g.archived ? "Restore grant" : "Archive grant"}
                </ActionButton>
              </div>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
