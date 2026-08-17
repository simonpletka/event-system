/*
  Warnings:

  - You are about to drop the column `clientEmail` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `clientName` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `clientPhone` on the `Event` table. All the data in the column will be lost.
  - Added the required column `number` to the `Event` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "EventContact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "EventContact_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ItemCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "ico" TEXT NOT NULL DEFAULT '',
    "dic" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "invoicingEmail" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Client" ("address", "createdAt", "dic", "ico", "id", "name", "note") SELECT "address", "createdAt", "dic", "ico", "id", "name", "note" FROM "Client";
DROP TABLE "Client";
ALTER TABLE "new_Client" RENAME TO "Client";
CREATE INDEX "Client_name_idx" ON "Client"("name");
CREATE TABLE "new_Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "brief" TEXT NOT NULL DEFAULT '',
    "companyName" TEXT NOT NULL,
    "companyAddress" TEXT NOT NULL DEFAULT '',
    "companyIco" TEXT NOT NULL DEFAULT '',
    "companyDic" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'INQUIRY',
    "clientId" TEXT,
    "buildDate" DATETIME,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "strikeDate" DATETIME,
    "quotedValue" INTEGER NOT NULL DEFAULT 0,
    "ownerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Event_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Event_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Event" ("brief", "buildDate", "clientId", "companyAddress", "companyDic", "companyIco", "companyName", "createdAt", "endDate", "id", "ownerId", "quotedValue", "startDate", "status", "strikeDate", "title", "updatedAt") SELECT "brief", "buildDate", "clientId", "companyAddress", "companyDic", "companyIco", "companyName", "createdAt", "endDate", "id", "ownerId", "quotedValue", "startDate", "status", "strikeDate", "title", "updatedAt" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
CREATE UNIQUE INDEX "Event_number_key" ON "Event"("number");
CREATE INDEX "Event_startDate_idx" ON "Event"("startDate");
CREATE INDEX "Event_status_idx" ON "Event"("status");
CREATE TABLE "new_Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "quoteId" TEXT,
    "number" TEXT NOT NULL,
    "variableSymbol" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CZK',
    "amountPaid" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "dueDate" DATETIME NOT NULL,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" DATETIME,
    "hideItemPrices" BOOLEAN NOT NULL DEFAULT true,
    "discountType" TEXT NOT NULL DEFAULT 'NONE',
    "discountValue" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Invoice_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Invoice_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Invoice" ("amountPaid", "currency", "dueDate", "eventId", "id", "issuedAt", "number", "paidAt", "quoteId", "status", "total", "variableSymbol") SELECT "amountPaid", "currency", "dueDate", "eventId", "id", "issuedAt", "number", "paidAt", "quoteId", "status", "total", "variableSymbol" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE INDEX "Invoice_dueDate_idx" ON "Invoice"("dueDate");
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");
CREATE TABLE "new_InvoiceItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" INTEGER NOT NULL,
    "vatRate" INTEGER NOT NULL DEFAULT 21,
    "category" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_InvoiceItem" ("description", "id", "invoiceId", "quantity", "sortOrder", "unitPrice", "vatRate") SELECT "description", "id", "invoiceId", "quantity", "sortOrder", "unitPrice", "vatRate" FROM "InvoiceItem";
DROP TABLE "InvoiceItem";
ALTER TABLE "new_InvoiceItem" RENAME TO "InvoiceItem";
CREATE TABLE "new_Quote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CZK',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "validUntil" DATETIME NOT NULL,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hideItemPrices" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Quote_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Quote" ("currency", "eventId", "id", "issuedAt", "number", "status", "total", "validUntil") SELECT "currency", "eventId", "id", "issuedAt", "number", "status", "total", "validUntil" FROM "Quote";
DROP TABLE "Quote";
ALTER TABLE "new_Quote" RENAME TO "Quote";
CREATE TABLE "new_QuoteItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quoteId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" INTEGER NOT NULL,
    "vatRate" INTEGER NOT NULL DEFAULT 21,
    "category" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "QuoteItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_QuoteItem" ("description", "id", "quantity", "quoteId", "sortOrder", "unitPrice", "vatRate") SELECT "description", "id", "quantity", "quoteId", "sortOrder", "unitPrice", "vatRate" FROM "QuoteItem";
DROP TABLE "QuoteItem";
ALTER TABLE "new_QuoteItem" RENAME TO "QuoteItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ItemCategory_name_key" ON "ItemCategory"("name");
