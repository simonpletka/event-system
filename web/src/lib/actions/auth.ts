"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { getLocale, getDictionary } from "@/lib/i18n";

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}

export type LoginState = { error?: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
    return {};
  } catch (err) {
    if (err instanceof AuthError) {
      const t = getDictionary(await getLocale());
      return { error: t.auth.invalidCredentials };
    }
    throw err;
  }
}
