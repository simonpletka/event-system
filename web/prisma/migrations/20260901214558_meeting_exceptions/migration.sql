-- CreateTable
CREATE TABLE "MeetingException" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "meetingId" TEXT NOT NULL,
    "originalDate" DATETIME NOT NULL,
    "newDate" DATETIME NOT NULL,
    CONSTRAINT "MeetingException_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "MeetingException_meetingId_originalDate_key" ON "MeetingException"("meetingId", "originalDate");
