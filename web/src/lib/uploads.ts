import { mkdir, writeFile, readFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const UPLOAD_ROOT = path.join(process.cwd(), "uploads", "receipts");
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
