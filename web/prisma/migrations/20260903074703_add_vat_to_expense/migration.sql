-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Expense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT,
    "paidById" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "vatRate" INTEGER NOT NULL DEFAULT 21,
    "vatAmount" INTEGER NOT NULL DEFAULT 0,
    "date" DATETIME NOT NULL,
    "category" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "receiptPath" TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Expense_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Expense_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Expense" ("amount", "approved", "category", "createdAt", "date", "id", "note", "paidById", "projectId", "receiptPath") SELECT "amount", "approved", "category", "createdAt", "date", "id", "note", "paidById", "projectId", "receiptPath" FROM "Expense";
DROP TABLE "Expense";
ALTER TABLE "new_Expense" RENAME TO "Expense";
CREATE INDEX "Expense_projectId_idx" ON "Expense"("projectId");
CREATE INDEX "Expense_date_idx" ON "Expense"("date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
