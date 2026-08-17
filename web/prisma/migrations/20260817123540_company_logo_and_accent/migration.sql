-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CompanySettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "ico" TEXT NOT NULL,
    "dic" TEXT NOT NULL,
    "isVatPayer" BOOLEAN NOT NULL DEFAULT true,
    "bankAccount" TEXT NOT NULL DEFAULT '',
    "defaultDueDays" INTEGER NOT NULL DEFAULT 14,
    "logoPath" TEXT,
    "accentColor" TEXT NOT NULL DEFAULT '#ec3013'
);
INSERT INTO "new_CompanySettings" ("address", "bankAccount", "defaultDueDays", "dic", "ico", "id", "isVatPayer", "name") SELECT "address", "bankAccount", "defaultDueDays", "dic", "ico", "id", "isVatPayer", "name" FROM "CompanySettings";
DROP TABLE "CompanySettings";
ALTER TABLE "new_CompanySettings" RENAME TO "CompanySettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
