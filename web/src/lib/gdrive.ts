import { google, type drive_v3 } from "googleapis";
import { Readable } from "stream";

export class DriveNotConfiguredError extends Error {
  constructor() {
    super(
      "Google Drive export isn't configured yet — set GOOGLE_SERVICE_ACCOUNT_JSON_BASE64 and GDRIVE_FINANCE_ROOT_FOLDER_ID in the environment."
    );
    this.name = "DriveNotConfiguredError";
  }
}

const FOLDER_MIME = "application/vnd.google-apps.folder";

let driveClient: drive_v3.Drive | null = null;

function getDrive(): drive_v3.Drive | null {
  if (driveClient) return driveClient;
  const keyB64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;
  if (!keyB64) return null;

  let credentials: { client_email: string; private_key: string };
  try {
    credentials = JSON.parse(Buffer.from(keyB64, "base64").toString("utf-8"));
  } catch {
    return null;
  }
  if (!credentials.client_email || !credentials.private_key) return null;

  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  driveClient = google.drive({ version: "v3", auth });
  return driveClient;
}

// Google Drive's query language only needs single-quote escaping inside a q= string literal.
function escapeQ(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function findFolder(drive: drive_v3.Drive, parentId: string, name: string): Promise<string | null> {
  const res = await drive.files.list({
    q: `'${parentId}' in parents and name='${escapeQ(name)}' and mimeType='${FOLDER_MIME}' and trashed=false`,
    fields: "files(id, name)",
    spaces: "drive",
  });
  return res.data.files?.[0]?.id ?? null;
}

async function findOrCreateFolder(drive: drive_v3.Drive, parentId: string, name: string): Promise<string> {
  const existing = await findFolder(drive, parentId, name);
  if (existing) return existing;
  const res = await drive.files.create({
    requestBody: { name, mimeType: FOLDER_MIME, parents: [parentId] },
    fields: "id",
  });
  return res.data.id!;
}

export type FinanceCategory = "quotes" | "invoices-issued" | "invoices-received";

// Matches the folder names the user already prepared under the Drive root — see CLAUDE.md.
const CATEGORY_FOLDER_NAMES: Record<FinanceCategory, string> = {
  quotes: "Quotes",
  "invoices-issued": "Invoices issued",
  "invoices-received": "Invoices received",
};

/**
 * Uploads (or overwrites, by exact filename, if this exact document was already exported once —
 * e.g. re-marking an invoice paid after an "undo") a finance document into
 * Root/<category folder>/<year>/<filename>, creating the category/year folders if missing.
 * Throws DriveNotConfiguredError when the service account or root folder ID aren't set — callers
 * that shouldn't fail their primary action over this should use tryUploadFinanceDocument instead.
 */
export async function uploadFinanceDocument(opts: {
  category: FinanceCategory;
  year: number;
  filename: string;
  buffer: Buffer;
  mimeType: string;
}) {
  const drive = getDrive();
  const root = process.env.GDRIVE_FINANCE_ROOT_FOLDER_ID;
  if (!drive || !root) throw new DriveNotConfiguredError();

  const categoryFolderId = await findOrCreateFolder(drive, root, CATEGORY_FOLDER_NAMES[opts.category]);
  const yearFolderId = await findOrCreateFolder(drive, categoryFolderId, String(opts.year));

  const existingRes = await drive.files.list({
    q: `'${yearFolderId}' in parents and name='${escapeQ(opts.filename)}' and trashed=false`,
    fields: "files(id)",
    spaces: "drive",
  });
  const existingId = existingRes.data.files?.[0]?.id;
  const media = { mimeType: opts.mimeType, body: Readable.from(opts.buffer) };

  if (existingId) {
    await drive.files.update({ fileId: existingId, media });
  } else {
    await drive.files.create({ requestBody: { name: opts.filename, parents: [yearFolderId] }, media, fields: "id" });
  }
}

/** Best-effort wrapper: never throws, so a Drive hiccup never fails the mark-as-paid/accept-quote/save-expense action it's attached to. */
export async function tryUploadFinanceDocument(
  opts: Parameters<typeof uploadFinanceDocument>[0]
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await uploadFinanceDocument(opts);
    return { ok: true };
  } catch (e) {
    if (e instanceof DriveNotConfiguredError) return { ok: false, error: e.message };
    console.error("Google Drive export failed:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Unknown Google Drive error." };
  }
}
