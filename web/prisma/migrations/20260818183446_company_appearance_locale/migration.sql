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
    "accentColor" TEXT NOT NULL DEFAULT '#ec3013',
    "bgColor" TEXT NOT NULL DEFAULT '#131211',
    "surfaceColor" TEXT NOT NULL DEFAULT '#1a1918',
    "inkColor" TEXT NOT NULL DEFAULT '#f3f2f2',
    "positiveColor" TEXT NOT NULL DEFAULT '#2dd4bf',
    "warningColor" TEXT NOT NULL DEFAULT '#dc2626',
    "locale" TEXT NOT NULL DEFAULT 'en'
);
INSERT INTO "new_CompanySettings" ("accentColor", "address", "bankAccount", "defaultDueDays", "dic", "ico", "id", "isVatPayer", "logoPath", "name") SELECT "accentColor", "address", "bankAccount", "defaultDueDays", "dic", "ico", "id", "isVatPayer", "logoPath", "name" FROM "CompanySettings";
DROP TABLE "CompanySettings";
ALTER TABLE "new_CompanySettings" RENAME TO "CompanySettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
