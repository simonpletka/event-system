-- CreateTable
CREATE TABLE "GearCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "GearType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "purchasePrice" INTEGER NOT NULL DEFAULT 0,
    "rateMode" TEXT NOT NULL DEFAULT 'AUTO',
    "ratePercent" REAL NOT NULL DEFAULT 3,
    "customDayRate" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GearType_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "GearCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GearUnit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "typeId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "GearUnit_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "GearType" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GearGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "GearGroupItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "typeId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "GearGroupItem_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "GearGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GearGroupItem_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "GearType" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GearReservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "unitId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
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

-- CreateIndex
CREATE UNIQUE INDEX "GearCategory_name_key" ON "GearCategory"("name");

-- CreateIndex
CREATE INDEX "GearType_categoryId_idx" ON "GearType"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "GearUnit_typeId_number_key" ON "GearUnit"("typeId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "GearGroupItem_groupId_typeId_key" ON "GearGroupItem"("groupId", "typeId");

-- CreateIndex
CREATE INDEX "GearReservation_unitId_startDate_endDate_idx" ON "GearReservation"("unitId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "GearReservation_projectId_idx" ON "GearReservation"("projectId");

-- CreateIndex
CREATE INDEX "GearReservation_batchId_idx" ON "GearReservation"("batchId");
