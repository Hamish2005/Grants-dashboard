"use client";
import { useDemo } from "./workspace-navigation";
import { workspaceFetch } from "@/lib/workspace-fetch";
import { useState } from "react";
import Link from "./workspace-navigation";
import { useRouter } from "./workspace-navigation";
import {
  ArrowLeft,
  Zap,
  Upload,
  Table2,
  ArrowRight,
  FileUp,
} from "lucide-react";
import { Button } from "./ui/button";
import { PageHeading } from "./common";
import { Field, apiAction } from "./forms";
import type { References, GrantRow } from "./tracker";
type Draft = Record<string, string>;
const fields = [
  "name",
  "programId",
  "cycle",
  "organization",
  "externalId",
  "requested",
  "awarded",
  "applicationDeadline",
  "startDate",
  "endDate",
  "reporting",
  "milestones",
];
const labels: Record<string, string> = {
  name: "Grant name",
  programId: "Funding program",
  cycle: "Funding cycle / year",
  organization: "Applicant / recipient",
  externalId: "External grant ID",
  requested: "Requested (USD)",
  awarded: "Awarded (USD)",
  applicationDeadline: "Application deadline",
  startDate: "Contract start",
  endDate: "Contract end",
  reporting: "Reporting requirements",
  milestones: "Important milestones",
};
type Preview = {
  token: string;
  headers: string[];
  rows: Draft[];
  mapping: Draft;
  warnings: string[];
};
export function NewGrant({
  refs,
  userId,
  grants,
  initialTab = "quick",
}: {
  refs: References;
  userId: string;
  grants: GrantRow[];
  initialTab?: string;
}) {
  const router = useRouter();
  const demo = useDemo();
  const [tab, setTab] = useState(initialTab);
  const [template, setTemplate] = useState("hhap");
  const [owner, setOwner] = useState(userId);
  const [start, setStart] = useState("0");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Draft>({});
  const [rows, setRows] = useState<Draft[]>([]);
  const [excluded, setExcluded] = useState<number[]>([]);
  const [mappingName, setMappingName] = useState("");
  const [mode, setMode] = useState("skip");
  const [result, setResult] = useState<{
    imported: number;
    updated: number;
    skipped: number;
    errors: { row: number; message: string }[];
  } | null>(null);
  const selectedTemplate = refs.templates.find((t) => t.id === template)!;
  const amount = (v: string | undefined) =>
    v?.trim() ? Math.round(Number(v.replace(/[$,]/g, "")) * 100) : null;
  const payload = (draft: Draft) => ({
    ...draft,
    templateId: draft.templateId || template,
    managerId: draft.managerId || owner,
    startingPosition: Number(draft.startingPosition || start),
    requested: amount(draft.requested),
    awarded: amount(draft.awarded),
    programId: draft.programId || "Other",
  });
  const mapRows = (p: Preview, m: Draft) =>
    p.rows.map((row) => {
      const draft: Draft = {};
      fields.forEach((f) => {
        draft[f] = row[m[f]] || "";
      });
      const prog = ["HHAP", "CoC", "YHDP", "Other"].find(
        (p) => p.toLowerCase() === draft.programId.toLowerCase(),
      );
      draft.programId = prog || draft.programId || "Other";
      draft.templateId = draft.awarded
        ? "active"
        : draft.programId === "CoC"
          ? "coc"
          : draft.programId === "HHAP"
            ? "hhap"
            : "active";
      draft.startingPosition = "0";
      draft.managerId = owner;
      return draft;
    });
  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await workspaceFetch("/api/import", {
        method: "POST",
        body,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setPreview(data);
      setMapping(data.mapping);
      setRows(mapRows(data, data.mapping));
      setExcluded([]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link className="back-link" href="/">
        <ArrowLeft size={14} />
        Back to overview
      </Link>
      <PageHeading
        title="Bring your grants into focus."
        description="Start with the essentials, or import a file you already have."
      />
      {demo && (
        <p className="help">
          Demo imports support CSV files. PDF, DOCX, and XLSX extraction is
          available in the hosted workspace. Attachments stay in this browser.
        </p>
      )}
      <div className="option-tabs">
        {[
          ["quick", "Quick add", "A name, a workflow, an owner.", Zap],
          [
            "file",
            "Upload a document",
            "Extract details from PDF or DOCX.",
            Upload,
          ],
          [
            "bulk",
            "Import a spreadsheet",
            "Review and map CSV or XLSX rows.",
            Table2,
          ],
        ]
          .filter(([value]) => !demo || value !== "file")
          .map(([value, label, desc, Icon]) => {
            const I = Icon as typeof Zap;
            return (
              <button
                key={String(value)}
                onClick={() => setTab(String(value))}
                className={`option-tab ${tab === value ? "active" : ""}`}
              >
                <I size={21} />
                <span>
                  <strong>
                    {demo && value === "bulk" ? "Import a CSV" : String(label)}
                  </strong>
                  <small>
                    {demo && value === "bulk"
                      ? "Review and map CSV rows."
                      : String(desc)}
                  </small>
                </span>
              </button>
            );
          })}
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {tab === "quick" ? (
        <form
          className="panel form-panel"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const draft = Object.fromEntries(
                new FormData(e.currentTarget).entries(),
              ) as Draft;
              const result = await apiAction({
                action: "create",
                ...payload(draft),
                templateId: template,
                managerId: owner,
                startingPosition: Number(start),
              });
              router.push("/grants/" + result.id);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2>New grant</h2>
          <p className="section-subtitle">
            Four essentials. Everything else can be added later.
          </p>
          <div className="form-grid">
            <Field label="Grant name *">
              <input
                required
                name="name"
                maxLength={200}
                placeholder="e.g. Community housing initiative"
              />
            </Field>
            <Field label="Workflow template *">
              <select
                value={template}
                onChange={(e) => {
                  setTemplate(e.target.value);
                  setStart("0");
                }}
              >
                {refs.templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Internal grant manager *">
              <select value={owner} onChange={(e) => setOwner(e.target.value)}>
                {refs.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Start tracking at *"
              hint="Earlier stages will be marked skipped; no historical completion dates are invented."
            >
              <select value={start} onChange={(e) => setStart(e.target.value)}>
                {selectedTemplate.stages.map((s, i) => (
                  <option key={s.id} value={i}>
                    {i + 1}. {s.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="help">
            {selectedTemplate.description} Staff members coordinate external
            decisions; independent scoring remains with the independent
            committee.
          </div>
          <details>
            <summary className="text-link">Add optional grant details</summary>
            <div className="form-grid" style={{ marginTop: 20 }}>
              <Field label="Funding program">
                <select name="programId" defaultValue="Other">
                  {["HHAP", "CoC", "YHDP", "Other"].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </Field>
              <Field label="Funding cycle">
                <select name="cycleId">
                  <option value="">No cycle yet</option>
                  {refs.cycles.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              {[
                "organization",
                "externalId",
                "requested",
                "awarded",
                "applicationDeadline",
                "startDate",
                "endDate",
              ].map((f) => (
                <Field key={f} label={labels[f]}>
                  <input
                    name={f}
                    type={
                      f.includes("Date") || f === "applicationDeadline"
                        ? "date"
                        : f === "requested" || f === "awarded"
                          ? "number"
                          : "text"
                    }
                    min={f === "requested" || f === "awarded" ? "0" : undefined}
                    step={
                      f === "requested" || f === "awarded" ? ".01" : undefined
                    }
                  />
                </Field>
              ))}
            </div>
          </details>
          <div className="form-actions">
            <Button disabled={busy}>
              {busy ? "Creating…" : "Create grant"}
              <ArrowRight size={15} />
            </Button>
            <Link className="text-link" href="/">
              Cancel
            </Link>
          </div>
        </form>
      ) : (
        <section className="panel form-panel" style={{ maxWidth: "none" }}>
          <h2>
            {tab === "bulk"
              ? "Import from a spreadsheet"
              : "Upload a grant document"}
          </h2>
          <p className="section-subtitle">
            {demo
              ? "Try a fictional CSV export. Your import stays in this browser."
              : "Manual exports from ZoomGrants and Dropbox are welcome. Files stay in the private workspace."}
          </p>
          <div className="help">
            Use grant-level documents only. Do not upload HMIS records or
            personal client information. Maximum 4 MB; 500 spreadsheet rows;
            {demo ? "CSV files only in this demo." : "PDF, DOCX, XLSX, CSV."}
          </div>
          <div
            className="dropzone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (!busy) void upload(e.dataTransfer.files[0]);
            }}
          >
            <FileUp size={32} />
            <strong>
              {busy ? "Reading your file…" : "Drop a file here to get started"}
            </strong>
            <small>Or choose a file from your computer</small>
            <input
              type="file"
              aria-label="Import file"
              accept={demo ? ".csv" : ".pdf,.docx,.xlsx,.csv"}
              disabled={busy}
              onChange={(e) => void upload(e.target.files?.[0])}
            />
          </div>
          {preview && !result && (
            <>
              <h2>1. Confirm column mappings</h2>
              <p className="section-subtitle">
                Unmapped fields stay blank. For documents, labeled values appear
                as columns.
              </p>
              {refs.mappings.length > 0 && (
                <Field label="Saved mapping">
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const saved = refs.mappings.find(
                        (m) => m.id === e.target.value,
                      );
                      if (saved) {
                        const m = JSON.parse(saved.fields);
                        setMapping(m);
                        setRows(mapRows(preview, m));
                      }
                    }}
                  >
                    <option value="">Choose a saved mapping</option>
                    {refs.mappings.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <div className="mapping-grid">
                {fields.map((f) => (
                  <Field key={f} label={labels[f]}>
                    <select
                      value={mapping[f] || ""}
                      onChange={(e) => {
                        const m = { ...mapping, [f]: e.target.value };
                        setMapping(m);
                        setRows(mapRows(preview, m));
                      }}
                    >
                      <option value="">Not mapped</option>
                      {preview.headers.map((h) => (
                        <option key={h}>{h}</option>
                      ))}
                    </select>
                  </Field>
                ))}
              </div>
              <Field label="Save mapping for future imports (optional)">
                <input
                  value={mappingName}
                  onChange={(e) => setMappingName(e.target.value)}
                  maxLength={100}
                  placeholder="e.g. ZoomGrants export"
                />
              </Field>
              <div className="help">
                {preview.warnings.join(" ")} Changing a column mapping rebuilds
                the preview below.
              </div>
              <h2>2. Review before importing</h2>
              <p className="section-subtitle">
                Edit each value and deselect rows you do not want. Amounts are
                in dollars. Dates must use YYYY-MM-DD.
              </p>
              <div className="table-scroll">
                <table className="import-table">
                  <thead>
                    <tr>
                      <th>Include</th>
                      <th>Review notes</th>
                      {[
                        ...fields,
                        "templateId",
                        "managerId",
                        "startingPosition",
                      ].map((f) => (
                        <th key={f}>
                          {labels[f] ||
                            (
                              {
                                templateId: "Workflow",
                                managerId: "Owner",
                                startingPosition: "Starting stage",
                              } as Draft
                            )[f]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => {
                      const duplicate = grants.find((g) =>
                        row.externalId
                          ? g.externalId === row.externalId
                          : g.name.toLowerCase() === row.name.toLowerCase(),
                      );
                      const inFileDuplicate =
                        row.externalId &&
                        rows.some(
                          (r, j) => j < i && r.externalId === row.externalId,
                        );
                      const set = (f: string, value: string) =>
                        setRows(
                          rows.map((r, j) =>
                            j === i
                              ? {
                                  ...r,
                                  [f]: value,
                                  ...(f === "templateId"
                                    ? { startingPosition: "0" }
                                    : {}),
                                }
                              : r,
                          ),
                        );
                      return (
                        <tr key={i}>
                          <td>
                            <input
                              type="checkbox"
                              aria-label={`Include row ${i + 1}`}
                              checked={!excluded.includes(i)}
                              onChange={(e) =>
                                setExcluded(
                                  e.target.checked
                                    ? excluded.filter((x) => x !== i)
                                    : [...excluded, i],
                                )
                              }
                            />
                          </td>
                          <td
                            style={{
                              minWidth: 210,
                              color:
                                duplicate || inFileDuplicate
                                  ? "#ae7950"
                                  : "#7a8c85",
                            }}
                          >
                            {duplicate
                              ? `Possible duplicate: ${duplicate.name}`
                              : inFileDuplicate
                                ? "Duplicate ID in this file"
                                : "New record"}
                            <br />
                            {!row.name ? "Grant name required. " : ""}
                            {!row.externalId ? "No grant ID. " : ""}
                            {!row.applicationDeadline
                              ? "No application deadline. "
                              : ""}
                            {!row.organization ? "Organization missing." : ""}
                          </td>
                          {fields.map((f) => (
                            <td key={f}>
                              {f === "programId" ? (
                                <select
                                  aria-label={`${labels[f]} row ${i + 1}`}
                                  value={row[f]}
                                  onChange={(e) => set(f, e.target.value)}
                                >
                                  {!["HHAP", "CoC", "YHDP", "Other"].includes(
                                    row[f],
                                  ) && <option>{row[f]}</option>}
                                  {["HHAP", "CoC", "YHDP", "Other"].map((p) => (
                                    <option key={p}>{p}</option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  aria-label={`${labels[f]} row ${i + 1}`}
                                  value={row[f] || ""}
                                  onChange={(e) => set(f, e.target.value)}
                                  placeholder={
                                    f.includes("Date") ||
                                    f === "applicationDeadline"
                                      ? "YYYY-MM-DD"
                                      : "Not provided"
                                  }
                                />
                              )}
                            </td>
                          ))}
                          <td>
                            <select
                              aria-label={`Template row ${i + 1}`}
                              value={row.templateId}
                              onChange={(e) =>
                                set("templateId", e.target.value)
                              }
                            >
                              {refs.templates.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <select
                              aria-label={`Owner row ${i + 1}`}
                              value={row.managerId}
                              onChange={(e) => set("managerId", e.target.value)}
                            >
                              {refs.users.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <select
                              aria-label={`Starting stage row ${i + 1}`}
                              value={row.startingPosition}
                              onChange={(e) =>
                                set("startingPosition", e.target.value)
                              }
                            >
                              {refs.templates
                                .find((t) => t.id === row.templateId)
                                ?.stages.map((s, j) => (
                                  <option key={s.id} value={j}>
                                    {s.name}
                                  </option>
                                ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="form-actions">
                <Field label="When a grant ID already exists">
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                  >
                    <option value="skip">Skip existing records</option>
                    <option value="update">
                      Update details (Manager / Admin)
                    </option>
                  </select>
                </Field>
                <Button
                  disabled={busy || rows.length === excluded.length}
                  onClick={async () => {
                    setBusy(true);
                    setError("");
                    try {
                      const response = await workspaceFetch("/api/import", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          token: preview.token,
                          rows: rows
                            .filter((_, i) => !excluded.includes(i))
                            .map(payload),
                          duplicateMode: mode,
                          mappingName,
                          mapping,
                        }),
                      });
                      const data = await response.json();
                      if (!response.ok) throw new Error(data.error);
                      setResult(data);
                      router.refresh();
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {busy
                    ? "Importing…"
                    : `Confirm ${rows.length - excluded.length} records`}
                  <ArrowRight size={15} />
                </Button>
              </div>
              <p className="muted" style={{ fontSize: 10, marginTop: 14 }}>
                Updates preserve the existing workflow and blank optional
                values. Matching uses exact grant IDs; name matches are advisory
                only. Preview expires after one hour.
              </p>
            </>
          )}
          {result && (
            <div>
              <div className="success">
                {result.imported} imported · {result.updated} updated ·{" "}
                {result.skipped} skipped · {result.errors.length} errors
              </div>
              {result.errors.map((e) => (
                <div key={e.row} className="error">
                  Row {e.row}: {e.message}
                </div>
              ))}
              <Button asChild>
                <Link href="/grants">
                  View grants
                  <ArrowRight size={14} />
                </Link>
              </Button>
              <p className="help">
                To retry failed rows, upload the file again and deselect
                successful rows. Existing grant IDs will be detected.
              </p>
            </div>
          )}
        </section>
      )}
    </>
  );
}
