-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GearReservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "unitId" TEXT NOT NULL,
    "projectId" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "groupId" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GearReservation_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "GearUnit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GearReservation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GearReservation_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "GearGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GearReservation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_GearReservation" ("batchId", "createdAt", "createdById", "endDate", "groupId", "id", "projectId", "startDate", "unitId") SELECT "batchId", "createdAt", "createdById", "endDate", "groupId", "id", "projectId", "startDate", "unitId" FROM "GearReservation";
DROP TABLE "GearReservation";
ALTER TABLE "new_GearReservation" RENAME TO "GearReservation";
CREATE INDEX "GearReservation_unitId_startDate_endDate_idx" ON "GearReservation"("unitId", "startDate", "endDate");
CREATE INDEX "GearReservation_projectId_idx" ON "GearReservation"("projectId");
CREATE INDEX "GearReservation_batchId_idx" ON "GearReservation"("batchId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
