-- AlterTable
ALTER TABLE "Event" ADD COLUMN "notionPageId" TEXT;

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "attendees" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "recurrenceFreq" TEXT NOT NULL DEFAULT 'NONE',
    "recurrenceInterval" INTEGER NOT NULL DEFAULT 1,
    "recurrenceUntil" DATETIME,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Meeting_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MeetingEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "meetingId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    CONSTRAINT "MeetingEvent_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MeetingEvent_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Meeting_date_idx" ON "Meeting"("date");

-- CreateIndex
CREATE INDEX "Meeting_type_idx" ON "Meeting"("type");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingEvent_meetingId_eventId_key" ON "MeetingEvent"("meetingId", "eventId");
