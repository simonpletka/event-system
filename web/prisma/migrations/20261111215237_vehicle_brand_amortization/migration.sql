/*
  Warnings:

  - The column `name` on the `Vehicle` table is copied into `model` below, so no names are lost.
  - Added the required column `model` to the `Vehicle` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Vehicle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "brand" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL,
    "fuelType" TEXT NOT NULL DEFAULT 'DIESEL',
    "consumptionPer100Km" REAL NOT NULL,
    "fuelPricePerLitre" REAL NOT NULL,
    "extraCostPerKm" REAL NOT NULL DEFAULT 0,
    "amortizationPerKm" REAL NOT NULL DEFAULT 5.9,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Vehicle_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
-- An existing car keeps its name as its type; the brand starts empty.
INSERT INTO "new_Vehicle" ("consumptionPer100Km", "createdAt", "extraCostPerKm", "fuelPricePerLitre", "fuelType", "id", "ownerId", "model") SELECT "consumptionPer100Km", "createdAt", "extraCostPerKm", "fuelPricePerLitre", "fuelType", "id", "ownerId", "name" FROM "Vehicle";
DROP TABLE "Vehicle";
ALTER TABLE "new_Vehicle" RENAME TO "Vehicle";
CREATE INDEX "Vehicle_ownerId_idx" ON "Vehicle"("ownerId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
