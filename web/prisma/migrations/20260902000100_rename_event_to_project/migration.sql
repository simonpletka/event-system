-- Rename the Event entity to Project, everywhere. Written by hand (not
-- `prisma migrate dev`'s own diff) using SQLite's native RENAME TABLE /
-- RENAME COLUMN, which preserve existing rows and auto-update foreign key
-- references in other tables — the auto-generated diff would have dropped
-- and recreated every affected table, losing data. InvoiceEvent/
-- InvoiceEventType are a separate, unrelated "event" (an audit-log entry)
-- and are deliberately left untouched.

-- RenameTable
ALTER TABLE "Event" RENAME TO "Project";
ALTER TABLE "EventContact" RENAME TO "ProjectContact";
ALTER TABLE "EventMember" RENAME TO "ProjectMember";
ALTER TABLE "MeetingEvent" RENAME TO "MeetingProject";

-- RenameColumn
ALTER TABLE "ProjectContact" RENAME COLUMN "eventId" TO "projectId";
ALTER TABLE "ProjectMember" RENAME COLUMN "eventId" TO "projectId";
ALTER TABLE "Venue" RENAME COLUMN "eventId" TO "projectId";
ALTER TABLE "RoadmapItem" RENAME COLUMN "eventId" TO "projectId";
ALTER TABLE "Expense" RENAME COLUMN "eventId" TO "projectId";
ALTER TABLE "TimeEntry" RENAME COLUMN "eventId" TO "projectId";
ALTER TABLE "Quote" RENAME COLUMN "eventId" TO "projectId";
ALTER TABLE "Invoice" RENAME COLUMN "eventId" TO "projectId";
ALTER TABLE "MeetingProject" RENAME COLUMN "eventId" TO "projectId";

-- RenameIndex (cosmetic only — functionally these already work after the
-- table/column renames above; recreated under the names a fresh migration
-- for this schema would generate, so future `prisma migrate dev` diffs
-- don't see a mismatch)
DROP INDEX "Event_number_key";
CREATE UNIQUE INDEX "Project_number_key" ON "Project"("number");
DROP INDEX "Event_startDate_idx";
CREATE INDEX "Project_startDate_idx" ON "Project"("startDate");
DROP INDEX "Event_status_idx";
CREATE INDEX "Project_status_idx" ON "Project"("status");
DROP INDEX "EventMember_eventId_userId_key";
CREATE UNIQUE INDEX "ProjectMember_projectId_userId_key" ON "ProjectMember"("projectId", "userId");
DROP INDEX "RoadmapItem_eventId_date_idx";
CREATE INDEX "RoadmapItem_projectId_date_idx" ON "RoadmapItem"("projectId", "date");
DROP INDEX "Expense_eventId_idx";
CREATE INDEX "Expense_projectId_idx" ON "Expense"("projectId");
DROP INDEX "MeetingEvent_meetingId_eventId_key";
CREATE UNIQUE INDEX "MeetingProject_meetingId_projectId_key" ON "MeetingProject"("meetingId", "projectId");
