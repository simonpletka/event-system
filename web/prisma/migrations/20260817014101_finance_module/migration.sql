/*
  Warnings:

  - Added the required column `variableSymbol` to the `Invoice` table without a default value. This is not possible if the table is not empty.
  - Added the required column `validUntil` to the `Quote` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "QuoteItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" INTEGER NOT NULL,
    "vatRate" INTEGER NOT NULL DEFAULT 21,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "QuoteItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" INTEGER NOT NULL,
    "vatRate" INTEGER NOT NULL DEFAULT 21,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT NOT NULL DEFAULT '',
    "recordedById" TEXT NOT NULL,
    CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Payment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InvoiceEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvoiceEvent_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InvoiceEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompanySettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "ico" TEXT NOT NULL,
    "dic" TEXT NOT NULL,
    "isVatPayer" BOOLEAN NOT NULL DEFAULT true,
    "bankAccount" TEXT NOT NULL DEFAULT '',
    "defaultDueDays" INTEGER NOT NULL DEFAULT 14
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Expense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT,
    "paidById" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "category" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "receiptPath" TEXT,
    "approved" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Expense_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Expense_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Expense" ("amount", "category", "createdAt", "date", "eventId", "id", "note", "paidById") SELECT "amount", "category", "createdAt", "date", "eventId", "id", "note", "paidById" FROM "Expense";
DROP TABLE "Expense";
ALTER TABLE "new_Expense" RENAME TO "Expense";
CREATE INDEX "Expense_eventId_idx" ON "Expense"("eventId");
CREATE INDEX "Expense_date_idx" ON "Expense"("date");
CREATE TABLE "new_Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "quoteId" TEXT,
    "number" TEXT NOT NULL,
    "variableSymbol" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "amountPaid" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "dueDate" DATETIME NOT NULL,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" DATETIME,
    CONSTRAINT "Invoice_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Invoice_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Invoice" ("dueDate", "eventId", "id", "issuedAt", "number", "status", "total") SELECT "dueDate", "eventId", "id", "issuedAt", "number", "status", "total" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE INDEX "Invoice_dueDate_idx" ON "Invoice"("dueDate");
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");
CREATE TABLE "new_Quote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "validUntil" DATETIME NOT NULL,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Quote_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Quote" ("eventId", "id", "issuedAt", "number", "status", "total") SELECT "eventId", "id", "issuedAt", "number", "status", "total" FROM "Quote";
DROP TABLE "Quote";
ALTER TABLE "new_Quote" RENAME TO "Quote";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "InvoiceEvent_invoiceId_createdAt_idx" ON "InvoiceEvent"("invoiceId", "createdAt");
