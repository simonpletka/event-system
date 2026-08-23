"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { getLocale, getDictionary } from "@/lib/i18n";
import { LAST_EMAIL_COOKIE } from "@/lib/auth-cookies";

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}

export type LoginState = { error?: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  try {
    // redirect:false so control returns here on success — needed to set the
    // remembered-email cookie before navigating away (signIn's own
    // redirectTo throws a NEXT_REDIRECT before any code after it can run).
    await signIn("credentials", { email, password, redirect: false });
  } catch (err) {
    if (err instanceof AuthError) {
      const t = getDictionary(await getLocale());
      return { error: t.auth.invalidCredentials };
    }
    throw err;
  }

  // Remembered purely for convenience — prefilled on the login page after a
  // session expires (e.g. the 8h auto sign-out) or any other sign-out, so
  // the user isn't stuck retyping their email. Not sensitive enough to
  // warrant httpOnly:false being a concern, but locked down anyway since
  // there's no reason a script needs to read it.
  const jar = await cookies();
  jar.set(LAST_EMAIL_COOKIE, email, {
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  redirect("/dashboard");
}
