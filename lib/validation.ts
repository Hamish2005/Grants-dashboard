import { z } from "zod";
export const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine(
    (v) =>
      !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
    "Invalid calendar date",
  );
const optText = z
  .string()
  .trim()
  .max(500)
  .nullish()
  .transform((v) => v || null);
const optDate = z
  .union([date, z.literal(""), z.null()])
  .optional()
  .transform((v) => v || null);
const amount = z.number().int().min(0).max(100_000_000_000_00).nullish();
export const grantInput = z
  .object({
    name: z.string().trim().min(1).max(200),
    templateId: z.string().min(1),
    managerId: z.string().min(1),
    startingPosition: z.coerce.number().int().min(0).default(0),
    programId: z.enum(["HHAP", "CoC", "YHDP", "Other"]).default("Other"),
    cycleId: optText,
    organization: optText,
    externalId: optText,
    requested: amount,
    awarded: amount,
    startDate: optDate,
    endDate: optDate,
    applicationDeadline: optDate,
    reporting: z.string().max(10000).nullish(),
    milestones: z.string().max(10000).nullish(),
  })
  .refine((v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, {
    message: "End date must follow start date",
    path: ["endDate"],
  });
export const stageInput = z
  .object({
    ownerId: z.string().min(1),
    externalParty: optText,
    duration: z.number().int().min(0).max(3650).nullable(),
    plannedStart: optDate,
    deadline: optDate,
    estimated: z.boolean(),
    status: z.enum(["In Progress", "Blocked"]),
    recalculate: z.boolean().default(false),
  })
  .refine(
    (v) => !v.plannedStart || !v.deadline || v.deadline >= v.plannedStart,
    { message: "Deadline must follow planned start" },
  );
