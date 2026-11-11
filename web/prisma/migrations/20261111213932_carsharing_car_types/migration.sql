-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CarsharingPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "carClass" TEXT NOT NULL DEFAULT '',
    "packagePrice" REAL NOT NULL DEFAULT 0,
    "packageMinutes" INTEGER,
    "packageKm" INTEGER NOT NULL DEFAULT 0,
    "minuteRate" REAL NOT NULL DEFAULT 0,
    "nightMinuteRate" REAL NOT NULL DEFAULT 0,
    "kmRate" REAL NOT NULL DEFAULT 0,
    "bandsJson" TEXT,
    "weekendOnly" BOOLEAN NOT NULL DEFAULT false,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_CarsharingPlan" ("active", "bandsJson", "carClass", "id", "kmRate", "minuteRate", "name", "packageKm", "packageMinutes", "packagePrice", "provider", "sortOrder", "verified", "weekendOnly") SELECT "active", "bandsJson", "carClass", "id", "kmRate", "minuteRate", "name", "packageKm", "packageMinutes", "packagePrice", "provider", "sortOrder", "verified", "weekendOnly" FROM "CarsharingPlan";
DROP TABLE "CarsharingPlan";
ALTER TABLE "new_CarsharingPlan" RENAME TO "CarsharingPlan";
CREATE TABLE "new_Trip" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "bufferMinutes" INTEGER NOT NULL DEFAULT 5,
    "carsharingModels" TEXT NOT NULL DEFAULT '{}',
    "routesUpdatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Trip_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Trip_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Trip" ("bufferMinutes", "createdAt", "createdById", "date", "id", "projectId", "routesUpdatedAt", "title", "updatedAt") SELECT "bufferMinutes", "createdAt", "createdById", "date", "id", "projectId", "routesUpdatedAt", "title", "updatedAt" FROM "Trip";
DROP TABLE "Trip";
ALTER TABLE "new_Trip" RENAME TO "Trip";
CREATE INDEX "Trip_projectId_idx" ON "Trip"("projectId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Car4way and Anytime tariffs are replaced by the 2026-11-11 price list; the
-- next read of the tariffs inserts the new ones (see getCarsharingPlans).
DELETE FROM "CarsharingPlan" WHERE "provider" IN ('Car4way', 'Anytime');
