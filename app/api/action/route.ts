import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { currentUser, checkOrigin, requireRole } from "@/lib/auth";
import {
  createGrant,
  updateGrant,
  updateStage,
  advanceGrant,
  addComment,
  setHold,
  pauseCycle,
  audit,
  id,
  now,
  editable,
  archiveGrant,
} from "@/lib/grants";
import { db } from "@/lib/db";
import * as s from "@/lib/db/schema";
import { date } from "@/lib/validation";
import { addDays } from "@/lib/utils";
import { limitedJson } from "@/lib/http";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const actor = await currentUser();
    if (Number(request.headers.get("content-length")) > 1000000)
      throw new Error("Request too large");
    const { action, ...input } = await limitedJson(request);
    let result: unknown = { ok: true };
    switch (action) {
      case "archive":
        archiveGrant(
          z.string().parse(input.id),
          z.boolean().parse(input.archived),
          actor,
        );
        break;
      case "create":
        result = { id: createGrant(input, actor) };
        break;
      case "updateGrant":
        updateGrant(z.string().parse(input.id), input, actor);
        break;
      case "stage":
        updateStage(
          z.string().parse(input.id),
          input,
          actor,
          z.string().parse(input.expectedStageId),
        );
        break;
      case "advance": {
        const v = z
          .object({
            id: z.string(),
            expectedStageId: z.string(),
            skip: z.boolean().optional(),
            reason: z.string().max(1000).optional(),
            decision: z.enum(["Selected", "Not Selected"]).optional(),
            appeals: z.boolean().optional(),
          })
          .parse(input);
        advanceGrant(v.id, actor, v);
        break;
      }
      case "comment": {
        const v = z
          .object({
            id: z.string(),
            stageId: z.string(),
            text: z.string(),
            indicator: z.string().nullable(),
          })
          .parse(input);
        addComment(v.id, v.stageId, v.text, v.indicator, actor);
        break;
      }
      case "hold":
        setHold(
          z.string().parse(input.id),
          z.boolean().parse(input.hold),
          actor,
        );
        break;
      case "cycle":
        pauseCycle(
          z.string().parse(input.id),
          z.boolean().parse(input.paused),
          actor,
        );
        break;
      case "link": {
        const v = z
          .object({
            id: z.string(),
            stageId: z.string(),
            name: z.string().trim().min(1).max(200),
            url: z
              .url()
              .refine(
                (v) => new URL(v).protocol === "https:",
                "Use an HTTPS document link",
              ),
          })
          .parse(input);
        const g = editable(v.id, actor);
        if (!g.stages.some((s) => s.id === v.stageId))
          throw new Error("Invalid stage");
        db.transaction(() => {
          db.insert(s.documents)
            .values({
              id: id(),
              grantId: v.id,
              stageId: v.stageId,
              name: v.name,
              url: v.url,
              createdBy: actor.id,
              createdAt: now(),
            })
            .run();
          audit(actor, v.id, "Document linked", { name: v.name, url: v.url });
        });
        break;
      }
      case "task": {
        const v = z
          .object({
            id: z.string(),
            name: z.string().trim().min(1).max(200),
            ownerId: z.string(),
            deadline: date,
            intervalDays: z.number().int().min(1).max(3650).nullable(),
          })
          .parse(input);
        editable(v.id, actor);
        db.transaction(() => {
          db.insert(s.tasks)
            .values({
              id: id(),
              grantId: v.id,
              name: v.name,
              ownerId: v.ownerId,
              deadline: v.deadline,
              intervalDays: v.intervalDays,
            })
            .run();
          audit(actor, v.id, "Reporting task created", v);
        });
        break;
      }
      case "completeTask": {
        const task = db
          .select()
          .from(s.tasks)
          .where(eq(s.tasks.id, z.string().parse(input.id)))
          .get();
        if (!task || task.completedAt) throw new Error("Task unavailable");
        if (actor.role === "Staff" && task.ownerId !== actor.id)
          throw new Error("Forbidden");
        db.transaction(() => {
          db.update(s.tasks)
            .set({ completedAt: now() })
            .where(eq(s.tasks.id, task.id))
            .run();
          if (task.intervalDays)
            db.insert(s.tasks)
              .values({
                ...task,
                id: id(),
                deadline: addDays(task.deadline, task.intervalDays),
                completedAt: null,
              })
              .run();
          audit(actor, task.grantId, "Reporting task completed", {
            taskId: task.id,
          });
        });
        break;
      }
      case "template": {
        requireRole(actor, ["Admin"]);
        const v = z
          .object({
            id: z.string().optional(),
            name: z.string().trim().min(1).max(100),
            description: z.string().max(2000),
            stages: z
              .array(
                z.object({
                  name: z.string().trim().min(1).max(200),
                  description: z.string().max(1000),
                  role: z.string().min(1).max(200),
                  defaultOwnerId: z.string().nullable(),
                  externalParty: z.string().max(200).nullable(),
                  duration: z.number().int().min(0).max(3650).nullable(),
                  optional: z.boolean(),
                  decision: z.boolean(),
                }),
              )
              .min(1)
              .max(50),
          })
          .parse(input);
        db.transaction(() => {
          const templateId = v.id || id();
          if (v.id) {
            db.update(s.templates)
              .set({ name: v.name, description: v.description })
              .where(eq(s.templates.id, templateId))
              .run();
            db.delete(s.templateStages)
              .where(eq(s.templateStages.templateId, templateId))
              .run();
          } else
            db.insert(s.templates)
              .values({
                id: templateId,
                name: v.name,
                description: v.description,
              })
              .run();
          v.stages.forEach((st, position) =>
            db
              .insert(s.templateStages)
              .values({ ...st, id: id(), templateId, position })
              .run(),
          );
          audit(actor, null, "Workflow template saved", { templateId, ...v });
        });
        break;
      }
      default:
        throw new Error("Unknown action");
    }
    return NextResponse.json(result);
  } catch (e) {
    const error = e instanceof Error ? e.message : "Request failed";
    return NextResponse.json(
      { error },
      {
        status: error.startsWith("Forbidden")
          ? 403
          : error.startsWith("Unauthorized")
            ? 401
            : 400,
      },
    );
  }
}
