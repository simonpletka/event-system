// A "use server" file may only export async functions, so this constant
// (shared between the login Server Action and the login page's cookie read)
// can't live in actions/auth.ts alongside loginAction.
export const LAST_EMAIL_COOKIE = "lastEmail";
