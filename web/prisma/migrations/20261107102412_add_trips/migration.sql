-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fuelType" TEXT NOT NULL DEFAULT 'DIESEL',
    "consumptionPer100Km" REAL NOT NULL,
    "fuelPricePerLitre" REAL NOT NULL,
    "extraCostPerKm" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Vehicle_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "bufferMinutes" INTEGER NOT NULL DEFAULT 5,
    "routesUpdatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Trip_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Trip_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TripStop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tripId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL,
    "lat" REAL,
    "lng" REAL,
    "arriveMin" INTEGER,
    "departMin" INTEGER,
    "stayMinutes" INTEGER,
    "manualMinutes" INTEGER,
    "legMinutes" INTEGER,
    "legKm" REAL,
    "legSource" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "TripStop_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CarsharingPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "carClass" TEXT NOT NULL DEFAULT '',
    "packagePrice" REAL NOT NULL DEFAULT 0,
    "packageMinutes" INTEGER,
    "packageKm" INTEGER NOT NULL DEFAULT 0,
    "minuteRate" REAL NOT NULL DEFAULT 0,
    "kmRate" REAL NOT NULL DEFAULT 0,
    "bandsJson" TEXT,
    "weekendOnly" BOOLEAN NOT NULL DEFAULT false,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE INDEX "Vehicle_ownerId_idx" ON "Vehicle"("ownerId");

-- CreateIndex
CREATE INDEX "Trip_projectId_idx" ON "Trip"("projectId");

-- CreateIndex
CREATE INDEX "TripStop_tripId_idx" ON "TripStop"("tripId");
