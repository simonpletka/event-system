// A "use server" file may only export async functions, so this constant
// (shared between the login Server Action and the login page's cookie read)
// can't live in actions/auth.ts alongside loginAction.
export const LAST_EMAIL_COOKIE = "lastEmail";

/** A post-login `next` target is only honored when it's a same-origin path (blocks open redirects like `//evil.com`). */
export function safeNextPath(next: string | null | undefined) {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/dashboard";
}
