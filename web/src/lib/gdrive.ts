import { google, type drive_v3 } from "googleapis";
import { Readable } from "stream";

export class DriveNotConfiguredError extends Error {
  constructor() {
    super(
      "Google Drive export isn't configured yet — set GDRIVE_ROOT_FOLDER_ID and the Drive credentials in the environment (see docs/API_SETUP.md)."
    );
    this.name = "DriveNotConfiguredError";
  }
}

const FOLDER_MIME = "application/vnd.google-apps.folder";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

// Lets every call work in a Shared Drive as well as in My Drive.
const ALL_DRIVES = { supportsAllDrives: true };
const LIST_ALL_DRIVES = { ...ALL_DRIVES, includeItemsFromAllDrives: true };

let driveClient: drive_v3.Drive | null = null;

/**
 * Two ways in. OAuth as a real person is what a My Drive folder needs: service
 * accounts have no storage and can't own files there. A service account works
 * only against a Shared Drive, so switching to one later is just a change of
 * environment variables.
 */
function getAuth() {
  const { GDRIVE_OAUTH_CLIENT_ID, GDRIVE_OAUTH_CLIENT_SECRET, GDRIVE_OAUTH_REFRESH_TOKEN } = process.env;
  if (GDRIVE_OAUTH_CLIENT_ID && GDRIVE_OAUTH_CLIENT_SECRET && GDRIVE_OAUTH_REFRESH_TOKEN) {
    const auth = new google.auth.OAuth2(GDRIVE_OAUTH_CLIENT_ID, GDRIVE_OAUTH_CLIENT_SECRET);
    auth.setCredentials({ refresh_token: GDRIVE_OAUTH_REFRESH_TOKEN });
    return auth;
  }

  const keyB64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64;
  if (!keyB64) return null;
  let credentials: { client_email: string; private_key: string };
  try {
    credentials = JSON.parse(Buffer.from(keyB64, "base64").toString("utf-8"));
  } catch {
    return null;
  }
  if (!credentials.client_email || !credentials.private_key) return null;
  return new google.auth.JWT({ email: credentials.client_email, key: credentials.private_key, scopes: [DRIVE_SCOPE] });
}

function getDrive(): drive_v3.Drive | null {
  if (driveClient) return driveClient;
  const auth = getAuth();
  if (!auth) return null;
  driveClient = google.drive({ version: "v3", auth });
  return driveClient;
}

export function isDriveConfigured() {
  return Boolean(process.env.GDRIVE_ROOT_FOLDER_ID && getDrive());
}

// Google Drive's query language only needs single-quote escaping inside a q= string literal.
function escapeQ(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function findFolder(drive: drive_v3.Drive, parentId: string, name: string): Promise<string | null> {
  const res = await drive.files.list({
    q: `'${parentId}' in parents and name='${escapeQ(name)}' and mimeType='${FOLDER_MIME}' and trashed=false`,
    fields: "files(id, name)",
    ...LIST_ALL_DRIVES,
  });
  return res.data.files?.[0]?.id ?? null;
}

async function findOrCreateFolder(drive: drive_v3.Drive, parentId: string, name: string): Promise<string> {
  const existing = await findFolder(drive, parentId, name);
  if (existing) return existing;
  const res = await drive.files.create({
    requestBody: { name, mimeType: FOLDER_MIME, parents: [parentId] },
    fields: "id",
    ...ALL_DRIVES,
  });
  return res.data.id!;
}

export type FinanceCategory = "quotes" | "invoices-issued" | "invoices-received";

// The Drive layout agreed for the company's "on production." root folder:
// EVENTS/<year>/<ID_project_name>/<subfolders> and FINANCE/<category>/<year>/.
const EVENTS_FOLDER = "EVENTS";
const FINANCE_FOLDER = "FINANCE";
const PROJECT_SUBFOLDERS = ["01_DOCS", "02_PROJECT", "03_REC", "04_PHOTO", "05_EXPORT"];

const CATEGORY_FOLDER_NAMES: Record<FinanceCategory, string> = {
  quotes: "PRICE_QUOTES",
  "invoices-issued": "SENT_INVOICES",
  "invoices-received": "RECEIVED_INVOICES",
};

// Filled by hand, not by the app, so they're only ever created up front.
const MANUAL_FINANCE_FOLDERS = ["BANK_STATEMENTS", "VAT_REPORTS", "ANNUAL_ACCOUNTS", "CONTRACTS", "PAYROLL"];

/**
 * Uploads (or overwrites, by exact filename, if this exact document was already exported once —
 * e.g. re-marking an invoice paid after an "undo") a finance document into
 * Root/FINANCE/<category folder>/<year>/<filename>, creating the category/year folders if missing.
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
  const root = process.env.GDRIVE_ROOT_FOLDER_ID;
  if (!drive || !root) throw new DriveNotConfiguredError();

  const financeFolderId = await findOrCreateFolder(drive, root, FINANCE_FOLDER);
  const categoryFolderId = await findOrCreateFolder(drive, financeFolderId, CATEGORY_FOLDER_NAMES[opts.category]);
  const yearFolderId = await findOrCreateFolder(drive, categoryFolderId, String(opts.year));

  const existingRes = await drive.files.list({
    q: `'${yearFolderId}' in parents and name='${escapeQ(opts.filename)}' and trashed=false`,
    fields: "files(id)",
    ...LIST_ALL_DRIVES,
  });
  const existingId = existingRes.data.files?.[0]?.id;
  const media = { mimeType: opts.mimeType, body: Readable.from(opts.buffer) };

  if (existingId) {
    await drive.files.update({ fileId: existingId, media, ...ALL_DRIVES });
  } else {
    await drive.files.create({ requestBody: { name: opts.filename, parents: [yearFolderId] }, media, fields: "id", ...ALL_DRIVES });
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

/** "26-008_Winter_Product_Demo": Drive allows nearly any name, but paths stay readable without spaces or slashes. */
export function projectFolderName(project: { number: string; title: string }) {
  const name = project.title
    .replace(/[\\/:*?"<>|]+/g, " ")
    .trim()
    .replace(/\s+/g, "_");
  return name ? `${project.number}_${name}` : project.number;
}

/** Creates the fixed part of the tree, so empty finance folders exist before anything lands in them. Safe to run twice. */
export async function ensureDriveStructure() {
  const drive = getDrive();
  const root = process.env.GDRIVE_ROOT_FOLDER_ID;
  if (!drive || !root) throw new DriveNotConfiguredError();

  await findOrCreateFolder(drive, root, EVENTS_FOLDER);
  const financeFolderId = await findOrCreateFolder(drive, root, FINANCE_FOLDER);
  for (const name of [...Object.values(CATEGORY_FOLDER_NAMES), ...MANUAL_FINANCE_FOLDERS]) {
    await findOrCreateFolder(drive, financeFolderId, name);
  }
}

export function driveFolderUrl(folderId: string) {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

/**
 * Finds or creates EVENTS/<year>/<ID_project_name> with its subfolders, so it
 * can safely run twice. Never moves or renames a folder that already exists:
 * the app links to it by id, so a retitled project keeps its folder.
 */
export async function ensureProjectFolder(project: { number: string; title: string; startDate: Date }) {
  const drive = getDrive();
  const root = process.env.GDRIVE_ROOT_FOLDER_ID;
  if (!drive || !root) throw new DriveNotConfiguredError();

  const eventsFolderId = await findOrCreateFolder(drive, root, EVENTS_FOLDER);
  const yearFolderId = await findOrCreateFolder(drive, eventsFolderId, String(project.startDate.getFullYear()));
  const projectFolderId = await findOrCreateFolder(drive, yearFolderId, projectFolderName(project));
  for (const name of PROJECT_SUBFOLDERS) await findOrCreateFolder(drive, projectFolderId, name);
  return projectFolderId;
}

/** Best-effort wrapper, like tryUploadFinanceDocument: a Drive hiccup never fails creating the project itself. */
export async function tryEnsureProjectFolder(project: Parameters<typeof ensureProjectFolder>[0]): Promise<string | null> {
  try {
    return await ensureProjectFolder(project);
  } catch (e) {
    if (!(e instanceof DriveNotConfiguredError)) console.error("Google Drive project folder failed:", e);
    return null;
  }
}
