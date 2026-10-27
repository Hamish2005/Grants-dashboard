"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, ArrowDown, Plus, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { Field, apiAction } from "./forms";
import { PageHeading, Badge } from "./common";
import type { References } from "./tracker";
type EditableStage = {
  name: string;
  description: string;
  role: string;
  defaultOwnerId: string | null;
  externalParty: string | null;
  duration: number | null;
  optional: boolean;
  decision: boolean;
};
type Editable = {
  id?: string;
  name: string;
  description: string;
  stages: EditableStage[];
};
const emptyStage: EditableStage = {
  name: "New stage",
  description: "",
  role: "Grants & Contracts",
  defaultOwnerId: null,
  externalParty: null,
  duration: null,
  optional: false,
  decision: false,
};
export function Templates({
  refs,
  admin,
}: {
  refs: References;
  admin: boolean;
}) {
  const [editor, setEditor] = useState<Editable | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const update = (index: number, values: Partial<EditableStage>) =>
    setEditor((e) =>
      e
        ? {
            ...e,
            stages: e.stages.map((s, i) =>
              i === index ? { ...s, ...values } : s,
            ),
          }
        : e,
    );
  return (
    <>
      <PageHeading
        title="Workflow templates"
        description="A consistent starting point. Flexible for each funding agreement."
        actions={
          admin && (
            <Button
              onClick={() =>
                setEditor({
                  name: "Custom workflow",
                  description: "",
                  stages: [{ ...emptyStage }],
                })
              }
            >
              <Plus size={14} />
              New template
            </Button>
          )
        }
      />
      <div className="help">
        All durations are editable calendar-day estimates. Unknown schedules
        remain blank. Changes to templates apply only to new grants; existing
        stage history is preserved.
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {editor ? (
        <form
          className="panel form-panel"
          style={{ maxWidth: "none" }}
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await apiAction({ action: "template", ...editor });
              setEditor(null);
              router.refresh();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="form-grid">
            <Field label="Template name">
              <input
                value={editor.name}
                required
                onChange={(e) => setEditor({ ...editor, name: e.target.value })}
              />
            </Field>
            <Field label="Planning guidance">
              <textarea
                value={editor.description}
                onChange={(e) =>
                  setEditor({ ...editor, description: e.target.value })
                }
              />
            </Field>
          </div>
          {editor.stages.map((s, i) => (
            <div className="editing-stage" key={i}>
              <div className="section-heading" style={{ padding: "0 0 16px" }}>
                <h3>Stage {i + 1}</h3>
                <div style={{ display: "flex", gap: 7 }}>
                  {[-1, 1].map((dir) => (
                    <Button
                      key={dir}
                      type="button"
                      variant="ghost"
                      disabled={i + dir < 0 || i + dir >= editor.stages.length}
                      aria-label={dir < 0 ? "Move stage up" : "Move stage down"}
                      onClick={() => {
                        const stages = [...editor.stages];
                        [stages[i], stages[i + dir]] = [
                          stages[i + dir],
                          stages[i],
                        ];
                        setEditor({ ...editor, stages });
                      }}
                    >
                      {dir < 0 ? (
                        <ArrowUp size={14} />
                      ) : (
                        <ArrowDown size={14} />
                      )}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label="Remove stage"
                    disabled={editor.stages.length < 2}
                    onClick={() =>
                      setEditor({
                        ...editor,
                        stages: editor.stages.filter((_, j) => j !== i),
                      })
                    }
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
              <div className="form-grid">
                <Field label="Stage name">
                  <input
                    value={s.name}
                    required
                    onChange={(e) => update(i, { name: e.target.value })}
                  />
                </Field>
                <Field label="Responsible role">
                  <input
                    value={s.role}
                    required
                    onChange={(e) => update(i, { role: e.target.value })}
                  />
                </Field>
                <Field label="Default staff coordinator">
                  <select
                    value={s.defaultOwnerId || ""}
                    onChange={(e) =>
                      update(i, { defaultOwnerId: e.target.value || null })
                    }
                  >
                    <option value="">Use grant manager</option>
                    {refs.users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="External decision maker">
                  <input
                    value={s.externalParty || ""}
                    onChange={(e) =>
                      update(i, { externalParty: e.target.value || null })
                    }
                  />
                </Field>
                <Field label="Estimated calendar days">
                  <input
                    type="number"
                    min="0"
                    max="3650"
                    value={s.duration ?? ""}
                    onChange={(e) =>
                      update(i, {
                        duration: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                  />
                </Field>
                <Field label="Description">
                  <input
                    value={s.description}
                    onChange={(e) => update(i, { description: e.target.value })}
                  />
                </Field>
              </div>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={s.optional}
                  onChange={(e) => update(i, { optional: e.target.checked })}
                />
                Optional stage (requires skip reason)
              </label>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={s.decision}
                  onChange={(e) => update(i, { decision: e.target.checked })}
                />
                Funding decision — not selected ends the workflow
              </label>
            </div>
          ))}
          <div className="form-actions">
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setEditor({
                  ...editor,
                  stages: [...editor.stages, { ...emptyStage }],
                })
              }
            >
              <Plus size={14} />
              Add stage
            </Button>
            <Button disabled={busy}>Save template</Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setEditor(null)}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <div className="template-grid">
          {refs.templates.map((t) => (
            <section className="panel template-card" key={t.id}>
              <Badge tone="green">{t.stages.length} stages</Badge>
              <h2 style={{ marginTop: 15 }}>{t.name}</h2>
              <p>{t.description}</p>
              <ol className="template-stages">
                {t.stages.map((s, i) => (
                  <li key={s.id}>
                    <span className="stage-index">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      {s.name}
                      {s.optional ? " · conditional" : ""}
                      {s.decision ? " · decision" : ""}
                      <small>
                        {s.externalParty
                          ? `External: ${s.externalParty} · `
                          : ""}
                        {s.role}
                      </small>
                    </div>
                    <span className="duration">
                      {s.duration == null
                        ? "No estimate"
                        : `${s.duration} days`}
                    </span>
                  </li>
                ))}
              </ol>
              {admin && (
                <div className="form-actions">
                  <Button variant="outline" onClick={() => setEditor(t)}>
                    Edit template
                  </Button>
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </>
  );
}
