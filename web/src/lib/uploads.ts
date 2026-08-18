import { mkdir, writeFile, readFile, unlink } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

// Defaults to `<cwd>/uploads` for local dev; set UPLOAD_DIR to point uploads
// at a mounted persistent volume in a stateless-filesystem deployment.
const DATA_ROOT = process.env.UPLOAD_DIR ?? process.cwd();
const UPLOAD_ROOT = path.join(DATA_ROOT, "uploads", "receipts");
const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};
const MAX_BYTES = 8 * 1024 * 1024;

export async function saveReceipt(file: File): Promise<string | null> {
  if (!file || file.size === 0) return null;
  if (file.size > MAX_BYTES) throw new Error("Receipt file is too large (max 8MB).");
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) throw new Error("Receipt must be a JPG, PNG, WEBP or PDF file.");

  await mkdir(UPLOAD_ROOT, { recursive: true });
  const filename = `${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_ROOT, filename), buffer);
  return filename;
}

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
};

export async function readReceipt(filename: string) {
  // filename comes from our own DB column, but guard against traversal anyway.
  const safe = path.basename(filename);
  const ext = safe.split(".").pop() ?? "";
  const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";
  const buffer = await readFile(path.join(UPLOAD_ROOT, safe));
  return { buffer, contentType };
}

export async function deleteReceipt(filename: string) {
  const safe = path.basename(filename);
  await unlink(path.join(UPLOAD_ROOT, safe)).catch(() => {});
}

const LOGO_ROOT = path.join(DATA_ROOT, "uploads", "logos");
const LOGO_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/svg+xml": "svg",
};
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export async function saveLogo(file: File): Promise<string | null> {
  if (!file || file.size === 0) return null;
  if (file.size > MAX_LOGO_BYTES) throw new Error("Logo file is too large (max 2MB).");
  const ext = LOGO_TYPES[file.type];
  if (!ext) throw new Error("Logo must be a PNG, JPG or SVG file.");

  await mkdir(LOGO_ROOT, { recursive: true });
  const filename = `${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(LOGO_ROOT, filename), buffer);
  return filename;
}

export async function deleteLogo(filename: string) {
  const safe = path.basename(filename);
  await unlink(path.join(LOGO_ROOT, safe)).catch(() => {});
}

const LOGO_CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  svg: "image/svg+xml",
};

export async function readLogo(filename: string) {
  const safe = path.basename(filename);
  const ext = safe.split(".").pop() ?? "";
  const contentType = LOGO_CONTENT_TYPES[ext] ?? "application/octet-stream";
  const buffer = await readFile(path.join(LOGO_ROOT, safe));
  return { buffer, contentType };
}

/** Base64 data URL for embedding directly in the server-rendered invoice PDF. react-pdf's Image can't fetch through our authenticated route handler. */
export async function readLogoAsDataUrl(filename: string): Promise<string | null> {
  try {
    const { buffer, contentType } = await readLogo(filename);
    if (contentType === "image/svg+xml") return null; // react-pdf's Image doesn't render SVG
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}
