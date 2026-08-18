/*
  Warnings:

  - You are about to drop the column `address` on the `Client` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "street" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "postCode" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT '',
    "ico" TEXT NOT NULL DEFAULT '',
    "dic" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "invoicingEmail" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Client" ("createdAt", "dic", "ico", "id", "invoicingEmail", "name", "note") SELECT "createdAt", "dic", "ico", "id", "invoicingEmail", "name", "note" FROM "Client";
DROP TABLE "Client";
ALTER TABLE "new_Client" RENAME TO "Client";
CREATE INDEX "Client_name_idx" ON "Client"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
