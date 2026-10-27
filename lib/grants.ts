import { randomUUID } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "./db";
import * as s from "./db/schema";
import { grantInput, stageInput } from "./validation";
import { type Actor, requireRole } from "./auth";
import { addDays, today } from "./utils";
export const now = () => new Date().toISOString();
export const id = () => randomUUID();
export function audit(
  actor: Actor,
  grantId: string | null,
  action: string,
  details: unknown,
) {
  db.insert(s.auditLogs)
    .values({
      id: id(),
      actorId: actor.id,
      grantId,
      action,
      details: JSON.stringify(details),
      createdAt: now(),
    })
    .run();
}
export function getGrant(grantId: string) {
  const grant = db
    .select()
    .from(s.grants)
    .where(eq(s.grants.id, grantId))
    .get();
  if (!grant) throw new Error("Grant not found");
  const stages = db
    .select()
    .from(s.stages)
    .where(eq(s.stages.grantId, grantId))
    .orderBy(asc(s.stages.position))
    .all();
  return {
    ...grant,
    stages,
    current: stages.find((x) => x.position === grant.currentPosition)!,
    next: stages.find(
      (x) => x.position > grant.currentPosition && x.status === "Not Started",
    ),
  };
}
export function referenceData() {
  return {
    users: db.select().from(s.users).all(),
    cycles: db.select().from(s.cycles).all(),
    templates: db
      .select()
      .from(s.templates)
      .all()
      .map((t) => ({
        ...t,
        stages: db
          .select()
          .from(s.templateStages)
          .where(eq(s.templateStages.templateId, t.id))
          .orderBy(asc(s.templateStages.position))
          .all(),
      })),
    mappings: db.select().from(s.mappings).all(),
  };
}
export function listGrants(includeArchived = false) {
  const refs = referenceData();
  return db
    .select()
    .from(s.grants)
    .orderBy(desc(s.grants.updatedAt))
    .all()
    .filter((g) => includeArchived || !g.archived)
    .map((g) => {
      const full = getGrant(g.id);
      const cycle = refs.cycles.find((c) => c.id === g.cycleId);
      const latest = db
        .select({ text: s.comments.text, createdAt: s.comments.createdAt })
        .from(s.comments)
        .innerJoin(s.stages, eq(s.comments.stageId, s.stages.id))
        .where(eq(s.stages.grantId, g.id))
        .orderBy(desc(s.comments.createdAt))
        .get();
      return {
        ...full,
        cycle,
        latest,
        owner: refs.users.find((u) => u.id === full.current.ownerId),
        nextOwner: refs.users.find((u) => u.id === full.next?.ownerId),
      };
    });
}
export function createGrant(raw: unknown, actor: Actor, demo = false) {
  const input = grantInput.parse(raw);
  return db.transaction(() => {
    if (!db.select().from(s.users).where(eq(s.users.id, input.managerId)).get())
      throw new Error("Owner not found");
    if (input.cycleId) {
      const c = db
        .select()
        .from(s.cycles)
        .where(eq(s.cycles.id, input.cycleId))
        .get();
      if (!c || c.programId !== input.programId)
        throw new Error("Funding cycle must match funding program");
    }
    const definitions = db
      .select()
      .from(s.templateStages)
      .where(eq(s.templateStages.templateId, input.templateId))
      .orderBy(asc(s.templateStages.position))
      .all();
    if (!definitions.length || !definitions[input.startingPosition])
      throw new Error("Invalid workflow or starting stage");
    if (
      input.externalId &&
      db
        .select()
        .from(s.grants)
        .where(eq(s.grants.externalId, input.externalId))
        .get()
    )
      throw new Error("Duplicate grant ID");
    const grantId = id();
    const { startingPosition, ...fields } = input;
    db.insert(s.grants)
      .values({
        ...fields,
        id: grantId,
        currentPosition: startingPosition,
        status:
          definitions[startingPosition].name === "Closed" ? "Closed" : "Active",
        demo,
        createdAt: now(),
        updatedAt: now(),
      })
      .run();
    let cursor: string | null = today();
    for (const stage of definitions) {
      const previous = stage.position < startingPosition;
      const current = stage.position === startingPosition;
      let deadline: string | null =
        !previous && cursor && stage.duration != null
          ? addDays(cursor, stage.duration)
          : null;
      let estimated = true;
      if (
        !previous &&
        input.applicationDeadline &&
        ["Funding Opportunity Open", "Local Application Submitted"].includes(
          stage.name,
        )
      ) {
        deadline = input.applicationDeadline;
        estimated = false;
      }
      if (
        !previous &&
        input.startDate &&
        [
          "Contract Executed",
          "Agreement / Startup",
          "Agreement & Budget Finalization",
        ].includes(stage.name)
      ) {
        deadline = input.startDate;
        estimated = false;
      }
      if (!previous && input.endDate && /Active.*Monitor/.test(stage.name)) {
        deadline = input.endDate;
        estimated = false;
      }
      db.insert(s.stages)
        .values({
          id: id(),
          grantId,
          position: stage.position,
          name: stage.name,
          description: stage.description,
          role: stage.role,
          ownerId: stage.defaultOwnerId || input.managerId,
          externalParty: stage.externalParty,
          duration: stage.duration,
          optional: stage.optional,
          decision: stage.decision,
          status: previous
            ? "Skipped"
            : current
              ? stage.name === "Closed"
                ? "Completed"
                : "In Progress"
              : "Not Started",
          skipReason: previous
            ? "Started tracking at a later stage; prior completion dates are unknown"
            : null,
          plannedStart: previous ? null : cursor,
          deadline: previous ? null : deadline,
          estimated,
          actualStart: current ? now() : null,
          completedAt: current && stage.name === "Closed" ? now() : null,
          updatedAt: now(),
          updatedBy: actor.id,
        })
        .run();
      if (!previous) cursor = deadline;
    }
    audit(actor, grantId, "Grant created", { ...input, demo });
    return grantId;
  });
}
export function updateGrant(grantId: string, raw: unknown, actor: Actor) {
  requireRole(actor, ["Admin", "Manager"]);
  const old = getGrant(grantId);
  const input = grantInput.parse({
    ...old,
    ...(raw as object),
    startingPosition: old.currentPosition,
  });
  if (input.cycleId) {
    const cycle = db
      .select()
      .from(s.cycles)
      .where(eq(s.cycles.id, input.cycleId))
      .get();
    if (!cycle || cycle.programId !== input.programId)
      throw new Error("Funding cycle must match funding program");
  }
  const { startingPosition: unused, templateId: ignored, ...fields } = input;
  void unused;
  void ignored;
  db.transaction(() => {
    db.update(s.grants)
      .set({ ...fields, updatedAt: now() })
      .where(eq(s.grants.id, grantId))
      .run();
    audit(actor, grantId, "Grant details updated", {
      before: old,
      after: fields,
    });
  });
}
export function editable(grantId: string, actor: Actor) {
  const g = getGrant(grantId);
  if (
    actor.role === "Staff" &&
    g.managerId !== actor.id &&
    g.current.ownerId !== actor.id
  )
    throw new Error(
      "Forbidden: only the assigned coordinator or manager may edit this grant",
    );
  return g;
}
function ensureActive(g: ReturnType<typeof getGrant>) {
  if (g.archived)
    throw new Error("Restore this archived grant before changing stages");
  if (g.status !== "Active")
    throw new Error("Grant must be active to change stages");
  if (
    g.cycleId &&
    db.select().from(s.cycles).where(eq(s.cycles.id, g.cycleId)).get()?.paused
  )
    throw new Error(
      "Funding cycle is paused; resume it before changing stages",
    );
}
export function archiveGrant(grantId: string, archived: boolean, actor: Actor) {
  requireRole(actor, ["Admin", "Manager"]);
  getGrant(grantId);
  db.transaction(() => {
    db.update(s.grants)
      .set({ archived, updatedAt: now() })
      .where(eq(s.grants.id, grantId))
      .run();
    audit(actor, grantId, archived ? "Grant archived" : "Grant restored", {});
  });
}
export function updateStage(
  grantId: string,
  raw: unknown,
  actor: Actor,
  expectedStageId?: string,
) {
  const values = stageInput.parse(raw);
  db.transaction(() => {
    const g = editable(grantId, actor);
    if (expectedStageId && g.current.id !== expectedStageId)
      throw new Error(
        "This stage changed in another session. Refresh before saving.",
      );
    ensureActive(g);
    const { recalculate, ...fields } = values;
    db.update(s.stages)
      .set({ ...fields, updatedAt: now(), updatedBy: actor.id })
      .where(eq(s.stages.id, g.current.id))
      .run();
    if (recalculate) {
      let cursor = fields.deadline;
      for (const stage of g.stages.filter(
        (x) => x.position > g.currentPosition && x.status === "Not Started",
      )) {
        if (!stage.estimated) {
          cursor = stage.deadline;
          continue;
        }
        const deadline =
          cursor && stage.duration != null
            ? addDays(cursor, stage.duration)
            : null;
        db.update(s.stages)
          .set({
            plannedStart: cursor,
            deadline,
            updatedAt: now(),
            updatedBy: actor.id,
          })
          .where(eq(s.stages.id, stage.id))
          .run();
        cursor = deadline;
      }
    }
    db.update(s.grants)
      .set({ updatedAt: now() })
      .where(eq(s.grants.id, grantId))
      .run();
    audit(actor, grantId, "Stage updated", {
      before: g.current,
      after: values,
    });
  });
}
export function advanceGrant(
  grantId: string,
  actor: Actor,
  options: {
    expectedStageId?: string;
    skip?: boolean;
    reason?: string;
    decision?: "Selected" | "Not Selected";
    appeals?: boolean;
  } = {},
) {
  return db.transaction(() => {
    const g = editable(grantId, actor);
    if (options.expectedStageId && g.current.id !== options.expectedStageId)
      throw new Error(
        "This stage already advanced. Refresh before continuing.",
      );
    ensureActive(g);
    if (g.current.status === "Blocked")
      throw new Error("Resolve the blocker before advancing");
    if (options.skip && (!g.current.optional || !options.reason?.trim()))
      throw new Error("Only optional stages may be skipped, with a reason");
    if (g.current.decision && !options.decision)
      throw new Error("Record a selected or not-selected funding decision");
    const next = g.stages.find(
      (x) => x.position > g.currentPosition && x.status === "Not Started",
    );
    if (next?.optional && options.appeals === undefined)
      throw new Error("Choose whether an appeal is required");
    db.update(s.stages)
      .set({
        status: options.skip ? "Skipped" : "Completed",
        skipReason: options.skip ? options.reason : null,
        completedAt: options.skip ? null : now(),
        updatedAt: now(),
        updatedBy: actor.id,
      })
      .where(eq(s.stages.id, g.current.id))
      .run();
    if (options.decision === "Not Selected") {
      for (const stage of g.stages.filter(
        (x) => x.position > g.currentPosition,
      ))
        db.update(s.stages)
          .set({
            status: "Skipped",
            skipReason: "Not selected for funding",
            updatedAt: now(),
            updatedBy: actor.id,
          })
          .where(eq(s.stages.id, stage.id))
          .run();
      db.update(s.grants)
        .set({ status: "Not Selected", updatedAt: now() })
        .where(eq(s.grants.id, grantId))
        .run();
    } else {
      let target = next;
      if (target?.optional && options.appeals === false) {
        db.update(s.stages)
          .set({
            status: "Skipped",
            skipReason: "No appeal required",
            updatedAt: now(),
            updatedBy: actor.id,
          })
          .where(eq(s.stages.id, target.id))
          .run();
        target = g.stages.find(
          (x) => x.position > target!.position && x.status === "Not Started",
        );
      }
      if (target) {
        const closed = target.name === "Closed";
        db.update(s.stages)
          .set({
            status: closed ? "Completed" : "In Progress",
            actualStart: now(),
            completedAt: closed ? now() : null,
            plannedStart: target.estimated ? today() : target.plannedStart,
            deadline: target.estimated
              ? target.duration != null
                ? addDays(today(), target.duration)
                : null
              : target.deadline,
            updatedAt: now(),
            updatedBy: actor.id,
          })
          .where(eq(s.stages.id, target.id))
          .run();
        db.update(s.grants)
          .set({
            currentPosition: target.position,
            status: closed ? "Closed" : "Active",
            updatedAt: now(),
          })
          .where(eq(s.grants.id, grantId))
          .run();
      } else
        db.update(s.grants)
          .set({ status: "Closed", updatedAt: now() })
          .where(eq(s.grants.id, grantId))
          .run();
    }
    audit(actor, grantId, "Stage advanced", {
      stage: g.current.name,
      ...options,
    });
    return getGrant(grantId);
  });
}
export function addComment(
  grantId: string,
  stageId: string,
  text: string,
  indicator: string | null,
  actor: Actor,
) {
  if (!text.trim() || text.length > 10000)
    throw new Error("Comment must contain 1–10,000 characters");
  if (indicator && !["Update", "Blocker", "Decision"].includes(indicator))
    throw new Error("Invalid comment indicator");
  const stage = db
    .select()
    .from(s.stages)
    .where(and(eq(s.stages.id, stageId), eq(s.stages.grantId, grantId)))
    .get();
  if (!stage) throw new Error("Stage not found");
  return db.transaction(() => {
    const commentId = id();
    db.insert(s.comments)
      .values({
        id: commentId,
        stageId,
        authorId: actor.id,
        text: text.trim(),
        indicator,
        createdAt: now(),
      })
      .run();
    db.update(s.grants)
      .set({ updatedAt: now() })
      .where(eq(s.grants.id, grantId))
      .run();
    audit(actor, grantId, "Comment added", {
      stageId,
      indicator,
      text: text.trim(),
    });
    return commentId;
  });
}
export function setHold(grantId: string, hold: boolean, actor: Actor) {
  requireRole(actor, ["Admin", "Manager"]);
  const g = getGrant(grantId);
  if (!["Active", "On Hold"].includes(g.status))
    throw new Error("Closed grants cannot be paused");
  db.transaction(() => {
    db.update(s.grants)
      .set({ status: hold ? "On Hold" : "Active", updatedAt: now() })
      .where(eq(s.grants.id, grantId))
      .run();
    audit(actor, grantId, hold ? "Grant paused" : "Grant resumed", {});
  });
}
export function pauseCycle(cycleId: string, paused: boolean, actor: Actor) {
  requireRole(actor, ["Admin", "Manager"]);
  if (!db.select().from(s.cycles).where(eq(s.cycles.id, cycleId)).get())
    throw new Error("Cycle not found");
  db.transaction(() => {
    db.update(s.cycles).set({ paused }).where(eq(s.cycles.id, cycleId)).run();
    audit(
      actor,
      null,
      paused ? "Funding cycle paused" : "Funding cycle resumed",
      { cycleId },
    );
  });
}
