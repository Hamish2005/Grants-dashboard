CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, role TEXT NOT NULL, team TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS programs (id TEXT PRIMARY KEY, name TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS cycles (id TEXT PRIMARY KEY, name TEXT NOT NULL, "programId" TEXT NOT NULL REFERENCES programs(id), paused BOOLEAN NOT NULL DEFAULT false);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS templates (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS template_stages (id TEXT PRIMARY KEY, "templateId" TEXT NOT NULL REFERENCES templates(id), position INTEGER NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL, role TEXT NOT NULL, "defaultOwnerId" TEXT REFERENCES users(id), "externalParty" TEXT, duration INTEGER, optional BOOLEAN NOT NULL DEFAULT false, decision BOOLEAN NOT NULL DEFAULT false);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS grants (id TEXT PRIMARY KEY, name TEXT NOT NULL, "programId" TEXT NOT NULL REFERENCES programs(id), "cycleId" TEXT REFERENCES cycles(id), "templateId" TEXT NOT NULL REFERENCES templates(id), organization TEXT, "externalId" TEXT UNIQUE, requested BIGINT, awarded BIGINT, "managerId" TEXT NOT NULL REFERENCES users(id), "startDate" TEXT, "endDate" TEXT, "applicationDeadline" TEXT, reporting TEXT, milestones TEXT, status TEXT NOT NULL DEFAULT 'Active', "currentPosition" INTEGER NOT NULL DEFAULT 0, demo BOOLEAN NOT NULL DEFAULT false, "createdAt" TEXT NOT NULL, "updatedAt" TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS stages (id TEXT PRIMARY KEY, "grantId" TEXT NOT NULL REFERENCES grants(id), position INTEGER NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL, role TEXT NOT NULL, "ownerId" TEXT NOT NULL REFERENCES users(id), "externalParty" TEXT, duration INTEGER, optional BOOLEAN NOT NULL DEFAULT false, decision BOOLEAN NOT NULL DEFAULT false, status TEXT NOT NULL DEFAULT 'Not Started', "plannedStart" TEXT, deadline TEXT, estimated BOOLEAN NOT NULL DEFAULT true, "actualStart" TEXT, "completedAt" TEXT, "skipReason" TEXT, "updatedAt" TEXT NOT NULL, "updatedBy" TEXT NOT NULL REFERENCES users(id));
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS stage_position ON stages("grantId",position);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS comments (id TEXT PRIMARY KEY, "stageId" TEXT NOT NULL REFERENCES stages(id), "authorId" TEXT NOT NULL REFERENCES users(id), text TEXT NOT NULL, indicator TEXT, "createdAt" TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY, "grantId" TEXT NOT NULL REFERENCES grants(id), "stageId" TEXT REFERENCES stages(id), name TEXT NOT NULL, path TEXT, url TEXT, mime TEXT, size INTEGER, "createdBy" TEXT NOT NULL REFERENCES users(id), "createdAt" TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS audit_logs (id TEXT PRIMARY KEY, "grantId" TEXT REFERENCES grants(id), "actorId" TEXT NOT NULL REFERENCES users(id), action TEXT NOT NULL, details TEXT NOT NULL, "createdAt" TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, "grantId" TEXT NOT NULL REFERENCES grants(id), "ownerId" TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL, deadline TEXT NOT NULL, "intervalDays" INTEGER, "completedAt" TEXT);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS mappings (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, fields TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS comments_stage ON comments("stageId","createdAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS audit_grant ON audit_logs("grantId","createdAt");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS grants_updated ON grants("updatedAt");
--> statement-breakpoint

ALTER TABLE grants ADD COLUMN archived BOOLEAN NOT NULL DEFAULT false;
--> statement-breakpoint

ALTER TABLE documents ADD COLUMN "commentId" TEXT REFERENCES comments(id);
--> statement-breakpoint
