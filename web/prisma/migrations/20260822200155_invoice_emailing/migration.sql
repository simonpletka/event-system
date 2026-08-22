-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "lastReminderAt" DATETIME;
ALTER TABLE "Invoice" ADD COLUMN "sentAt" DATETIME;

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
    "locale" TEXT NOT NULL DEFAULT 'en',
    "invoiceEmailSubject" TEXT NOT NULL DEFAULT 'Invoice {{invoiceNumber}} from {{companyName}}',
    "invoiceEmailBody" TEXT NOT NULL DEFAULT 'Hi {{clientName}},

Please find attached invoice {{invoiceNumber}} for {{eventTitle}}, totaling {{amount}}, due {{dueDate}}.

Thank you,
{{companyName}}',
    "reminderEmailSubject" TEXT NOT NULL DEFAULT 'Reminder: invoice {{invoiceNumber}} is overdue',
    "reminderEmailBody" TEXT NOT NULL DEFAULT 'Hi {{clientName}},

This is a friendly reminder that invoice {{invoiceNumber}} for {{eventTitle}}, totaling {{amount}}, was due {{dueDate}} ({{daysOverdue}} days ago) and is still unpaid.

The invoice is attached again for your convenience.

Thank you,
{{companyName}}'
);
INSERT INTO "new_CompanySettings" ("accentColor", "address", "bankAccount", "bgColor", "defaultDueDays", "dic", "ico", "id", "inkColor", "isVatPayer", "locale", "logoPath", "name", "positiveColor", "surfaceColor", "warningColor") SELECT "accentColor", "address", "bankAccount", "bgColor", "defaultDueDays", "dic", "ico", "id", "inkColor", "isVatPayer", "locale", "logoPath", "name", "positiveColor", "surfaceColor", "warningColor" FROM "CompanySettings";
DROP TABLE "CompanySettings";
ALTER TABLE "new_CompanySettings" RENAME TO "CompanySettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
