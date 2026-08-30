-- CreateTable
CREATE TABLE "RoadmapItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT NOT NULL DEFAULT '',
    "googleCalendarEventId" TEXT,
    "googleMeetUrl" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RoadmapItem_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RoadmapItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RoadmapAssignee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "RoadmapAssignee_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "RoadmapItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RoadmapAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RoadmapExternalAttendee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "RoadmapExternalAttendee_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "RoadmapItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RoadmapComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "itemId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoadmapComment_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "RoadmapItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RoadmapComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "RoadmapItem_eventId_date_idx" ON "RoadmapItem"("eventId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "RoadmapAssignee_itemId_userId_key" ON "RoadmapAssignee"("itemId", "userId");

-- CreateIndex
CREATE INDEX "RoadmapComment_itemId_createdAt_idx" ON "RoadmapComment"("itemId", "createdAt");

-- Migrate existing Milestone rows forward (keep ids; supply both timestamps —
-- @updatedAt has no SQLite default). Runs after every CREATE TABLE, before DROP.
INSERT INTO "RoadmapItem"
    ("id", "eventId", "type", "title", "date", "allDay", "done", "note", "googleCalendarEventId", "googleMeetUrl", "createdById", "createdAt", "updatedAt")
SELECT
    "id", "eventId", 'MILESTONE', "title", "date", false, false, '', "googleCalendarEventId", NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Milestone";

-- DropTable
PRAGMA foreign_keys=OFF;
DROP TABLE "Milestone";
PRAGMA foreign_keys=ON;
