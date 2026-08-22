// Pure, client-safe: no nodemailer import here (that needs Node's net/tls, which breaks the
// browser bundle if a Client Component pulls it in — see src/lib/email.ts for the server-only
// sending logic, and CLAUDE.md's "Prisma-in-client-bundle" note for the same class of bug).

/** Tokens available in the Settings → Invoice emailing templates. */
export const EMAIL_TEMPLATE_TOKENS = [
  "invoiceNumber",
  "companyName",
  "clientName",
  "eventTitle",
  "amount",
  "dueDate",
  "daysOverdue",
] as const;

export type EmailTemplateVars = Partial<Record<(typeof EMAIL_TEMPLATE_TOKENS)[number], string>>;

/** Replaces every {{token}} in a template string with the matching var (blank if missing). */
export function renderEmailTemplate(template: string, vars: EmailTemplateVars): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => vars[key as keyof EmailTemplateVars] ?? "");
}

// Mirrors the @default(...) values on CompanySettings in schema.prisma — duplicated here (not
// imported from the DB) so the Settings form has sensible starting text even before any
// CompanySettings row exists (the empty-seed dev state has none — see prisma/seed-empty.ts).
export const DEFAULT_INVOICE_EMAIL_SUBJECT = "Invoice {{invoiceNumber}} from {{companyName}}";
export const DEFAULT_INVOICE_EMAIL_BODY =
  "Hi {{clientName}},\n\nPlease find attached invoice {{invoiceNumber}} for {{eventTitle}}, totaling {{amount}}, due {{dueDate}}.\n\nThank you,\n{{companyName}}";
export const DEFAULT_REMINDER_EMAIL_SUBJECT = "Reminder: invoice {{invoiceNumber}} is overdue";
export const DEFAULT_REMINDER_EMAIL_BODY =
  "Hi {{clientName}},\n\nThis is a friendly reminder that invoice {{invoiceNumber}} for {{eventTitle}}, totaling {{amount}}, was due {{dueDate}} ({{daysOverdue}} days ago) and is still unpaid.\n\nThe invoice is attached again for your convenience.\n\nThank you,\n{{companyName}}";
