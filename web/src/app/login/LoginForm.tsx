"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "@/lib/actions/auth";
import { PasswordInput } from "@/components/ui/PasswordInput";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="heading-label">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          className="bg-transparent border border-ink/35 px-3 py-2 text-sm outline-none focus:border-ink"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="heading-label">
          Password
        </label>
        <PasswordInput id="password" name="password" required autoComplete="current-password" />
      </div>

      {state.error && <p className="text-sm text-accent">{state.error}</p>}

      <button type="submit" disabled={pending} className="btn mt-2">
        {pending ? "Signing in…" : "Sign in"}
      </button>

      <div className="rule-thin my-2" />
      <button type="button" disabled className="btno opacity-40 cursor-not-allowed">
        Continue with Google — coming soon
      </button>
    </form>
  );
}
