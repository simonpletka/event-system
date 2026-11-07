-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TripStop" (
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
    "splitRental" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "TripStop_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TripStop" ("address", "arriveMin", "departMin", "id", "label", "lat", "legKm", "legMinutes", "legSource", "lng", "manualMinutes", "note", "position", "stayMinutes", "tripId") SELECT "address", "arriveMin", "departMin", "id", "label", "lat", "legKm", "legMinutes", "legSource", "lng", "manualMinutes", "note", "position", "stayMinutes", "tripId" FROM "TripStop";
DROP TABLE "TripStop";
ALTER TABLE "new_TripStop" RENAME TO "TripStop";
CREATE INDEX "TripStop_tripId_idx" ON "TripStop"("tripId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
