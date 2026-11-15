/**
 * Server-side structured logging: one JSON object per line on stdout/stderr,
 * which systemd's journal keeps on the production VM. Find an error a user
 * reported by the "ref" on the error page:
 *
 *   journalctl -u eventsystem | grep '"ref":"2470174526"'
 *
 * Never pass request headers, cookies or form bodies in `fields`: they carry
 * session tokens and personal data.
 */
type Fields = Record<string, unknown>;

function errorFields(err: unknown): Fields {
  if (err instanceof Error) {
    const digest = (err as Error & { digest?: unknown }).digest;
    return {
      ...(digest !== undefined ? { ref: String(digest) } : {}),
      error: err.name,
      message: err.message,
      stack: err.stack,
      ...(err.cause !== undefined ? { cause: err.cause instanceof Error ? err.cause.message : String(err.cause) } : {}),
    };
  }
  return { message: String(err) };
}

function write(level: "info" | "warn" | "error", event: string, fields: Fields) {
  const line = JSON.stringify({ time: new Date().toISOString(), level, event, ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  info: (event: string, fields: Fields = {}) => write("info", event, fields),
  warn: (event: string, fields: Fields = {}) => write("warn", event, fields),
  /** `err` supplies message, stack and (for errors React/Next caught) the "ref" digest. */
  error: (event: string, err: unknown, fields: Fields = {}) => write("error", event, { ...errorFields(err), ...fields }),
};
