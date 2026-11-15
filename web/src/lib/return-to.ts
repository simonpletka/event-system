/**
 * A `?returnTo=` value is only honoured when it's a path on this site
 * ("/projects/…"), never "//evil.com" or "https://…", so a crafted link
 * can't bounce someone off the app after they save a form.
 */
export function safeReturnTo(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  return value;
}
