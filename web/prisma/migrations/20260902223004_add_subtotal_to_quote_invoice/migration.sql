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
    "accountNumber" TEXT NOT NULL DEFAULT '',
    "swiftBic" TEXT NOT NULL DEFAULT '',
    "defaultDueDays" INTEGER NOT NULL DEFAULT 14,
    "logoPath" TEXT,
    "accentColor" TEXT NOT NULL DEFAULT '#ec3013',
    "bgColor" TEXT NOT NULL DEFAULT '#131211',
    "surfaceColor" TEXT NOT NULL DEFAULT '#1a1918',
    "inkColor" TEXT NOT NULL DEFAULT '#f3f2f2',
    "positiveColor" TEXT NOT NULL DEFAULT '#2dd4bf',
    "warningColor" TEXT NOT NULL DEFAULT '#dc2626',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "invoiceEmailSubject" TEXT NOT NULL DEFAULT 'Invoice {{invoiceNumber}} from {{companyName}}',
    "invoiceEmailBody" TEXT NOT NULL DEFAULT 'Hi {{clientName}},

Please find attached invoice {{invoiceNumber}} for {{projectTitle}}, totaling {{amount}}, due {{dueDate}}.

Thank you,
{{companyName}}',
    "reminderEmailSubject" TEXT NOT NULL DEFAULT 'Reminder: invoice {{invoiceNumber}} is overdue',
    "reminderEmailBody" TEXT NOT NULL DEFAULT 'Hi {{clientName}},

This is a friendly reminder that invoice {{invoiceNumber}} for {{projectTitle}}, totaling {{amount}}, was due {{dueDate}} ({{daysOverdue}} days ago) and is still unpaid.

The invoice is attached again for your convenience.

Thank you,
{{companyName}}'
);
INSERT INTO "new_CompanySettings" ("accentColor", "accountNumber", "address", "bankAccount", "bgColor", "defaultDueDays", "dic", "ico", "id", "inkColor", "invoiceEmailBody", "invoiceEmailSubject", "isVatPayer", "locale", "logoPath", "name", "positiveColor", "reminderEmailBody", "reminderEmailSubject", "surfaceColor", "swiftBic", "warningColor") SELECT "accentColor", "accountNumber", "address", "bankAccount", "bgColor", "defaultDueDays", "dic", "ico", "id", "inkColor", "invoiceEmailBody", "invoiceEmailSubject", "isVatPayer", "locale", "logoPath", "name", "positiveColor", "reminderEmailBody", "reminderEmailSubject", "surfaceColor", "swiftBic", "warningColor" FROM "CompanySettings";
DROP TABLE "CompanySettings";
ALTER TABLE "new_CompanySettings" RENAME TO "CompanySettings";
CREATE TABLE "new_Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "quoteId" TEXT,
    "number" TEXT NOT NULL,
    "variableSymbol" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'CZK',
    "amountPaid" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ISSUED',
    "dueDate" DATETIME NOT NULL,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" DATETIME,
    "hideItemPrices" BOOLEAN NOT NULL DEFAULT true,
    "discountType" TEXT NOT NULL DEFAULT 'NONE',
    "discountValue" INTEGER NOT NULL DEFAULT 0,
    "sentAt" DATETIME,
    "lastReminderAt" DATETIME,
    CONSTRAINT "Invoice_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Invoice_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Invoice" ("amountPaid", "currency", "discountType", "discountValue", "dueDate", "hideItemPrices", "id", "issuedAt", "lastReminderAt", "number", "paidAt", "projectId", "quoteId", "sentAt", "status", "total", "variableSymbol") SELECT "amountPaid", "currency", "discountType", "discountValue", "dueDate", "hideItemPrices", "id", "issuedAt", "lastReminderAt", "number", "paidAt", "projectId", "quoteId", "sentAt", "status", "total", "variableSymbol" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE INDEX "Invoice_dueDate_idx" ON "Invoice"("dueDate");
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");
CREATE TABLE "new_Quote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "total" INTEGER NOT NULL,
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'CZK',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "validUntil" DATETIME NOT NULL,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hideItemPrices" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    CONSTRAINT "Quote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Quote_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Quote" ("createdById", "currency", "hideItemPrices", "id", "issuedAt", "number", "projectId", "status", "total", "validUntil") SELECT "createdById", "currency", "hideItemPrices", "id", "issuedAt", "number", "projectId", "status", "total", "validUntil" FROM "Quote";
DROP TABLE "Quote";
ALTER TABLE "new_Quote" RENAME TO "Quote";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
