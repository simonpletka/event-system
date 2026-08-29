-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "brief" TEXT NOT NULL DEFAULT '',
    "companyName" TEXT NOT NULL,
    "companyAddress" TEXT NOT NULL DEFAULT '',
    "companyIco" TEXT NOT NULL DEFAULT '',
    "companyDic" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'INQUIRY',
    "clientId" TEXT,
    "buildDate" DATETIME,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "strikeDate" DATETIME,
    "quotedValue" INTEGER NOT NULL DEFAULT 0,
    "budgetType" TEXT NOT NULL DEFAULT 'NONE',
    "budgetValue" INTEGER NOT NULL DEFAULT 0,
    "ownerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Event_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Event_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Event" ("brief", "buildDate", "clientId", "companyAddress", "companyDic", "companyIco", "companyName", "createdAt", "endDate", "id", "number", "ownerId", "quotedValue", "startDate", "status", "strikeDate", "title", "updatedAt") SELECT "brief", "buildDate", "clientId", "companyAddress", "companyDic", "companyIco", "companyName", "createdAt", "endDate", "id", "number", "ownerId", "quotedValue", "startDate", "status", "strikeDate", "title", "updatedAt" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
CREATE UNIQUE INDEX "Event_number_key" ON "Event"("number");
CREATE INDEX "Event_startDate_idx" ON "Event"("startDate");
CREATE INDEX "Event_status_idx" ON "Event"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
