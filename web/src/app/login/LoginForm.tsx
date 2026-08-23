"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/lib/actions/auth";
import { PasswordInput } from "@/components/ui/PasswordInput";
import type { Dictionary } from "@/lib/dictionary";

const initialState: LoginState = {};

export function LoginForm({ t, defaultEmail }: { t: Dictionary["auth"]; defaultEmail?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="heading-label">
          {t.email}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          defaultValue={defaultEmail}
          className="bg-transparent border border-ink/35 px-3 py-2 text-sm outline-none focus:border-ink"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="heading-label">
          {t.password}
        </label>
        <PasswordInput id="password" name="password" required autoComplete="current-password" holdToShowLabel={t.holdToShowPassword} />
      </div>

      {state.error && <p className="text-sm text-warning">{state.error}</p>}

      <button type="submit" disabled={pending} className="btn mt-2">
        {pending ? t.signingIn : t.signIn}
      </button>

      <div className="rule-thin my-2" />
      <button type="button" disabled className="btno opacity-40 cursor-not-allowed">
        {t.continueWithGoogle}
      </button>
    </form>
  );
}
