/*
  Warnings:

  - You are about to drop the column `active` on the `GearUnit` table. All the data in the column will be lost.
  - Added the required column `code` to the `GearUnit` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "GearIssue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "unitId" TEXT NOT NULL,
    "reportedById" TEXT,
    "reportedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "severity" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "projectId" TEXT,
    "reservationId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolvedAt" DATETIME,
    "resolvedById" TEXT,
    "resolutionNote" TEXT,
    "repairCost" INTEGER,
    CONSTRAINT "GearIssue_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "GearUnit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GearIssue_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GearIssue_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GearIssue_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "GearReservation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GearIssue_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GearIssuePhoto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "issueId" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GearIssuePhoto_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "GearIssue" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GearUnitEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "unitId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorId" TEXT,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data" TEXT NOT NULL DEFAULT '{}',
    CONSTRAINT "GearUnitEvent_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "GearUnit" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GearUnitEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

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
    "pickedUpAt" DATETIME,
    "pickedUpById" TEXT,
    "returnedAt" DATETIME,
    "returnedById" TEXT,
    "returnCondition" TEXT,
    CONSTRAINT "GearReservation_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "GearUnit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GearReservation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GearReservation_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "GearGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GearReservation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GearReservation_pickedUpById_fkey" FOREIGN KEY ("pickedUpById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GearReservation_returnedById_fkey" FOREIGN KEY ("returnedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_GearReservation" ("batchId", "createdAt", "createdById", "endDate", "groupId", "id", "note", "projectId", "startDate", "unitId") SELECT "batchId", "createdAt", "createdById", "endDate", "groupId", "id", "note", "projectId", "startDate", "unitId" FROM "GearReservation";
DROP TABLE "GearReservation";
ALTER TABLE "new_GearReservation" RENAME TO "GearReservation";
CREATE INDEX "GearReservation_unitId_startDate_endDate_idx" ON "GearReservation"("unitId", "startDate", "endDate");
CREATE INDEX "GearReservation_projectId_idx" ON "GearReservation"("projectId");
CREATE INDEX "GearReservation_batchId_idx" ON "GearReservation"("batchId");
CREATE TABLE "new_GearUnit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "typeId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "condition" TEXT NOT NULL DEFAULT 'OK',
    "conditionNote" TEXT,
    "backAt" TEXT,
    "code" TEXT NOT NULL,
    "tagUid" TEXT,
    CONSTRAINT "GearUnit_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "GearType" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
-- Back-fill: retired units (active = 0) become RETIRED, and every unit gets a
-- random 8-character Crockford base32 code (32^8 ≈ 1.1e12, so a clash among a
-- few hundred units is practically impossible; the unique index below would
-- stop the migration rather than store one).
INSERT INTO "new_GearUnit" ("id", "label", "number", "typeId", "condition", "code")
SELECT "id", "label", "number", "typeId",
       CASE WHEN "active" THEN 'OK' ELSE 'RETIRED' END,
       substr('0123456789ABCDEFGHJKMNPQRSTVWXYZ', (abs(random()) % 32) + 1, 1) || substr('0123456789ABCDEFGHJKMNPQRSTVWXYZ', (abs(random()) % 32) + 1, 1) || substr('0123456789ABCDEFGHJKMNPQRSTVWXYZ', (abs(random()) % 32) + 1, 1) || substr('0123456789ABCDEFGHJKMNPQRSTVWXYZ', (abs(random()) % 32) + 1, 1) || substr('0123456789ABCDEFGHJKMNPQRSTVWXYZ', (abs(random()) % 32) + 1, 1) || substr('0123456789ABCDEFGHJKMNPQRSTVWXYZ', (abs(random()) % 32) + 1, 1) || substr('0123456789ABCDEFGHJKMNPQRSTVWXYZ', (abs(random()) % 32) + 1, 1) || substr('0123456789ABCDEFGHJKMNPQRSTVWXYZ', (abs(random()) % 32) + 1, 1)
FROM "GearUnit";
DROP TABLE "GearUnit";
ALTER TABLE "new_GearUnit" RENAME TO "GearUnit";
CREATE UNIQUE INDEX "GearUnit_code_key" ON "GearUnit"("code");
CREATE UNIQUE INDEX "GearUnit_tagUid_key" ON "GearUnit"("tagUid");
CREATE UNIQUE INDEX "GearUnit_typeId_number_key" ON "GearUnit"("typeId", "number");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "GearIssue_unitId_idx" ON "GearIssue"("unitId");

-- CreateIndex
CREATE INDEX "GearIssue_status_idx" ON "GearIssue"("status");

-- CreateIndex
CREATE UNIQUE INDEX "GearIssuePhoto_storedName_key" ON "GearIssuePhoto"("storedName");

-- CreateIndex
CREATE INDEX "GearIssuePhoto_issueId_idx" ON "GearIssuePhoto"("issueId");

-- CreateIndex
CREATE INDEX "GearUnitEvent_unitId_at_idx" ON "GearUnitEvent"("unitId", "at");
