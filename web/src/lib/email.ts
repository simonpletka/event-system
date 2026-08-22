import nodemailer from "nodemailer";

export { EMAIL_TEMPLATE_TOKENS, renderEmailTemplate, type EmailTemplateVars } from "@/lib/email-templates";

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

export class EmailNotConfiguredError extends Error {
  constructor() {
    super("Email sending isn't configured yet — set SMTP_HOST, SMTP_USER and SMTP_PASS in the environment.");
    this.name = "EmailNotConfiguredError";
  }
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
}) {
  const transport = getTransporter();
  if (!transport) throw new EmailNotConfiguredError();

  const from = process.env.SMTP_FROM || process.env.SMTP_USER!;
  await transport.sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    attachments: opts.attachments,
  });
}
