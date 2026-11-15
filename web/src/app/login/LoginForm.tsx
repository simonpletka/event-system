"use client";

import { useActionState, useState } from "react";
import { loginAction, type LoginState } from "@/lib/actions/auth";
import { PasswordInput } from "@/components/ui/PasswordInput";
import type { Dictionary } from "@/lib/dictionary";

const initialState: LoginState = {};

export function LoginForm({ t, defaultEmail, next }: { t: Dictionary["auth"]; defaultEmail?: string; next: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  // Which button was pressed, so only that one says "Signing in…".
  const [mode, setMode] = useState<"real" | "test">("real");

  const submitOnEnter: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      setMode("real");
      e.currentTarget.form?.requestSubmit();
    }
  };

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="field-label">
          {t.email}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          defaultValue={state.email ?? defaultEmail}
          onKeyDown={submitOnEnter}
          enterKeyHint="next"
          className="input !py-2.5 w-full"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="field-label">
          {t.password}
        </label>
        <PasswordInput
          id="password"
          name="password"
          required
          autoComplete="current-password"
          holdToShowLabel={t.holdToShowPassword}
          onKeyDown={submitOnEnter}
          inputClassName="input !py-2.5"
        />
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-warning bg-warning/10 rounded-[10px] px-3 py-2">
          {state.error}
        </p>
      )}

      {/* Both buttons submit the same email and password; the pressed one's
          name/value picks the view (Enter submits with neither, i.e. real). */}
      <button
        type="submit"
        name="mode"
        value="real"
        disabled={pending}
        onClick={() => setMode("real")}
        className="btn !py-3 mt-2 w-full"
      >
        {pending && mode === "real" ? t.signingIn : t.signIn}
      </button>

      <div className="flex items-center gap-3 my-1">
        <div className="rule-thin flex-1" />
        <span className="heading-label">{t.or}</span>
        <div className="rule-thin flex-1" />
      </div>
      <button
        type="submit"
        name="mode"
        value="test"
        disabled={pending}
        onClick={() => setMode("test")}
        className="btno !border-ink/25 !py-3 w-full"
      >
        {pending && mode === "test" ? t.preparingTesting : t.testingSignIn}
      </button>
      <p className="text-xs placeholder-text text-center -mt-1">{t.testingHint}</p>
    </form>
  );
}
