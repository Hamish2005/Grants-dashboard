import {
  pgTable,
  text,
  integer,
  boolean,
  bigint,
  uniqueIndex,
} from "drizzle-orm/pg-core";
export const users = pgTable("users", {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  role: text().notNull(),
  team: text().notNull(),
});
export const programs = pgTable("programs", {
  id: text().primaryKey(),
  name: text().notNull(),
});
export const cycles = pgTable("cycles", {
  id: text().primaryKey(),
  name: text().notNull(),
  programId: text()
    .notNull()
    .references(() => programs.id),
  paused: boolean().notNull().default(false),
});
export const templates = pgTable("templates", {
  id: text().primaryKey(),
  name: text().notNull(),
  description: text().notNull(),
});
export const templateStages = pgTable("template_stages", {
  id: text().primaryKey(),
  templateId: text()
    .notNull()
    .references(() => templates.id),
  position: integer().notNull(),
  name: text().notNull(),
  description: text().notNull(),
  role: text().notNull(),
  defaultOwnerId: text().references(() => users.id),
  externalParty: text(),
  duration: integer(),
  optional: boolean().notNull().default(false),
  decision: boolean().notNull().default(false),
});
export const grants = pgTable("grants", {
  id: text().primaryKey(),
  name: text().notNull(),
  programId: text()
    .notNull()
    .references(() => programs.id),
  cycleId: text().references(() => cycles.id),
  templateId: text()
    .notNull()
    .references(() => templates.id),
  organization: text(),
  externalId: text().unique(),
  requested: bigint({ mode: "number" }),
  awarded: bigint({ mode: "number" }),
  managerId: text()
    .notNull()
    .references(() => users.id),
  startDate: text(),
  endDate: text(),
  applicationDeadline: text(),
  reporting: text(),
  milestones: text(),
  status: text().notNull().default("Active"),
  archived: boolean().notNull().default(false),
  currentPosition: integer().notNull().default(0),
  demo: boolean().notNull().default(false),
  createdAt: text().notNull(),
  updatedAt: text().notNull(),
});
export const stages = pgTable(
  "stages",
  {
    id: text().primaryKey(),
    grantId: text()
      .notNull()
      .references(() => grants.id),
    position: integer().notNull(),
    name: text().notNull(),
    description: text().notNull(),
    role: text().notNull(),
    ownerId: text()
      .notNull()
      .references(() => users.id),
    externalParty: text(),
    duration: integer(),
    optional: boolean().notNull().default(false),
    decision: boolean().notNull().default(false),
    status: text().notNull().default("Not Started"),
    plannedStart: text(),
    deadline: text(),
    estimated: boolean().notNull().default(true),
    actualStart: text(),
    completedAt: text(),
    skipReason: text(),
    updatedAt: text().notNull(),
    updatedBy: text()
      .notNull()
      .references(() => users.id),
  },
  (t) => [uniqueIndex("stage_position").on(t.grantId, t.position)],
);
export const comments = pgTable("comments", {
  id: text().primaryKey(),
  stageId: text()
    .notNull()
    .references(() => stages.id),
  authorId: text()
    .notNull()
    .references(() => users.id),
  text: text().notNull(),
  indicator: text(),
  createdAt: text().notNull(),
});
export const documents = pgTable("documents", {
  id: text().primaryKey(),
  grantId: text()
    .notNull()
    .references(() => grants.id),
  stageId: text().references(() => stages.id),
  commentId: text().references(() => comments.id),
  name: text().notNull(),
  path: text(),
  url: text(),
  mime: text(),
  size: integer(),
  createdBy: text()
    .notNull()
    .references(() => users.id),
  createdAt: text().notNull(),
});
export const auditLogs = pgTable("audit_logs", {
  id: text().primaryKey(),
  grantId: text().references(() => grants.id),
  actorId: text()
    .notNull()
    .references(() => users.id),
  action: text().notNull(),
  details: text().notNull(),
  createdAt: text().notNull(),
});
export const tasks = pgTable("tasks", {
  id: text().primaryKey(),
  grantId: text()
    .notNull()
    .references(() => grants.id),
  ownerId: text()
    .notNull()
    .references(() => users.id),
  name: text().notNull(),
  deadline: text().notNull(),
  intervalDays: integer(),
  completedAt: text(),
});
export const mappings = pgTable("mappings", {
  id: text().primaryKey(),
  name: text().notNull().unique(),
  fields: text().notNull(),
});
