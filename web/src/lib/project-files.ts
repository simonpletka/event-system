export const MAX_PROJECT_FILE_MB = 50;

export type PreviewKind = "pdf" | "image" | "text" | "word" | "sheet";

const KINDS: Record<string, { kind: PreviewKind; contentType: string }> = {
  pdf: { kind: "pdf", contentType: "application/pdf" },
  jpg: { kind: "image", contentType: "image/jpeg" },
  jpeg: { kind: "image", contentType: "image/jpeg" },
  png: { kind: "image", contentType: "image/png" },
  webp: { kind: "image", contentType: "image/webp" },
  gif: { kind: "image", contentType: "image/gif" },
  txt: { kind: "text", contentType: "text/plain; charset=utf-8" },
  csv: { kind: "text", contentType: "text/plain; charset=utf-8" },
  md: { kind: "text", contentType: "text/plain; charset=utf-8" },
  docx: { kind: "word", contentType: "application/octet-stream" },
  xlsx: { kind: "sheet", contentType: "application/octet-stream" },
};

/**
 * Keyed on the extension rather than the browser's reported type, which is
 * often blank for Office files. Anything not listed is download-only: serving
 * uploaded HTML or SVG inline would run its scripts on the app's own origin.
 */
export function previewOf(filename: string) {
  return KINDS[filename.split(".").pop()?.toLowerCase() ?? ""] ?? null;
}
