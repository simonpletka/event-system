"use client";

import { useActionState, useState } from "react";
import {
  updateOwnProfileAction,
  updateOwnPasswordAction,
  updateOwnLanguageAction,
  type SettingsFormState,
} from "@/lib/actions/settings";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { getDictionary, type Locale } from "@/lib/dictionary";

const initialState: SettingsFormState = {};

export function GeneralSettingsForm({
  defaults,
  currentLocale,
  locale,
}: {
  defaults: { name: string; email: string; phone: string; avatarPath: string | null };
  /** The user's own stored language choice — always resolves to a real language now that there's no "company default" option; falls back to `locale` below only for an account that's never saved one yet. */
  currentLocale: Locale | null;
  /** The app's currently-resolved locale, for this component's own labels — not the same thing as `currentLocale` above. */
  locale: Locale;
}) {
  const t = getDictionary(locale).settings.general;
  const [profileState, profileAction, profilePending] = useActionState(updateOwnProfileAction, initialState);
  const [passwordState, passwordAction, passwordPending] = useActionState(updateOwnPasswordAction, initialState);
  const [languageState, languageAction, languagePending] = useActionState(updateOwnLanguageAction, initialState);

  // Best-effort split of the single stored `name` — see updateOwnProfileAction's
  // comment for why there's no separate firstName/lastName column.
  const spaceIdx = defaults.name.indexOf(" ");
  const initialFirst = spaceIdx === -1 ? defaults.name : defaults.name.slice(0, spaceIdx);
  const initialLast = spaceIdx === -1 ? "" : defaults.name.slice(spaceIdx + 1);

  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFileName, setAvatarFileName] = useState<string | null>(null);
  const [languageChoice, setLanguageChoice] = useState<Locale>(currentLocale ?? locale);
  // React's own "adjusting state when a prop changes" pattern — setState
  // during render, not in an effect (which the project's eslint config
  // forbids for exactly this reason: it'd cost an extra commit). Re-syncs
  // after a successful save: the Server Action's automatic RSC refresh
  // sends a fresh `currentLocale` reflecting the real saved value, but the
  // `useState` initializer above only ever runs once on mount — left alone,
  // the radios would keep showing whatever was clicked pre-submit instead
  // of the actual DB value. Doesn't touch `languageState`, so the
  // success/error message from the action itself is unaffected.
  const [prevCurrentLocale, setPrevCurrentLocale] = useState(currentLocale);
  if (currentLocale !== prevCurrentLocale) {
    setPrevCurrentLocale(currentLocale);
    setLanguageChoice(currentLocale ?? locale);
  }

  return (
    <div className="w-full flex flex-col gap-4">
      <form action={profileAction} className="card p-5 flex flex-col gap-3">
        <div className="heading-label !text-[12px]">{t.accountHeading}</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="field-label">{t.firstNameLabel}</span>
            <input name="firstName" defaultValue={initialFirst} required className="input" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="field-label">{t.lastNameLabel}</span>
            <input name="lastName" defaultValue={initialLast} className="input" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="field-label">{t.emailLabel}</span>
            <input name="email" type="email" defaultValue={defaults.email} required className="input" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="field-label">{t.phoneLabel}</span>
            <input name="phone" type="tel" defaultValue={defaults.phone} className="input" />
          </label>
        </div>

        <div className="flex gap-3 items-start mt-1">
          <div className="flex flex-col gap-1.5 flex-1">
            <span className="field-label">{t.photoLabel}</span>
            <div className="flex items-center gap-2">
              <label htmlFor="avatar-upload" className="btno cursor-pointer">
                {t.chooseFile}
              </label>
              {avatarFileName && <span className="text-[11px] placeholder-text truncate">{avatarFileName}</span>}
            </div>
            <input
              id="avatar-upload"
              name="avatar"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0];
                setRemoveAvatar(false);
                setAvatarPreview(file ? URL.createObjectURL(file) : null);
                setAvatarFileName(file ? file.name : null);
              }}
              className="sr-only"
            />
            <span className="text-[9px] placeholder-text">{t.photoHelper}</span>
            {defaults.avatarPath && !removeAvatar && !avatarFileName && (
              <label className="flex items-center gap-1.5 text-[11px]">
                <input
                  name="removeAvatar"
                  type="checkbox"
                  checked={removeAvatar}
                  onChange={(e) => {
                    setRemoveAvatar(e.target.checked);
                    setAvatarPreview(null);
                  }}
                />
                {t.removePhotoLabel}
              </label>
            )}
          </div>
          <div className="w-16 h-16 rounded-full border border-ink/16 flex items-center justify-center shrink-0 overflow-hidden bg-ink/4">
            {avatarPreview ? (
              // eslint-disable-next-line @next/next/no-img-element -- ephemeral blob: preview URL, not a static asset
              <img src={avatarPreview} alt={t.newPhotoPreviewAlt} className="w-full h-full object-cover" />
            ) : defaults.avatarPath && !removeAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element -- authenticated route, not a static asset next/image can optimize
              <img src={`/api/uploads/avatar/${defaults.avatarPath}`} alt={t.profilePhotoAlt} className="w-full h-full object-cover" />
            ) : (
              <span className="text-[9px] placeholder-text text-center px-1">{t.noPhoto}</span>
            )}
          </div>
        </div>

        {profileState.error && <p className="text-sm text-warning">{profileState.error}</p>}
        {profileState.success && <p className="text-sm text-positive font-bold">{profileState.success}</p>}

        <button type="submit" disabled={profilePending} className="btn self-start mt-1">
          {profilePending ? t.saving : t.saveChanges}
        </button>
      </form>

      <form action={passwordAction} className="card p-5 flex flex-col gap-3">
        <div className="heading-label !text-[12px]">{t.passwordHeading}</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="currentPassword" className="field-label">
              {t.currentPasswordLabel}
            </label>
            <PasswordInput id="currentPassword" name="currentPassword" autoComplete="current-password" required holdToShowLabel={t.holdToShowPassword} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="newPassword" className="field-label">
              {t.newPasswordLabel}
            </label>
            <PasswordInput id="newPassword" name="newPassword" autoComplete="new-password" required holdToShowLabel={t.holdToShowPassword} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirmPassword" className="field-label">
              {t.confirmPasswordLabel}
            </label>
            <PasswordInput id="confirmPassword" name="confirmPassword" autoComplete="new-password" required holdToShowLabel={t.holdToShowPassword} />
          </div>
        </div>

        {passwordState.error && <p className="text-sm text-warning">{passwordState.error}</p>}
        {passwordState.success && <p className="text-sm text-positive font-bold">{passwordState.success}</p>}

        <button type="submit" disabled={passwordPending} className="btn self-start mt-1">
          {passwordPending ? t.changingPassword : t.changePassword}
        </button>
      </form>

      <form action={languageAction} className="card p-5 flex flex-col gap-3">
        <div className="heading-label !text-[12px]">{t.languageHeading}</div>
        <p className="text-[10px] placeholder-text -mt-1 max-w-prose">{t.languageIntro}</p>
        {/* Keyed on the resolved locale: after a successful save, React's own
            controlled-radio reconciliation doesn't reliably re-patch the
            `checked` DOM property on a *sibling* radio when the "checked one"
            changes underneath it via a server-triggered refresh (confirmed by
            inspecting the live DOM — internal state was correct, but the
            native `.checked` property stayed on the old radio) — remounting
            these two inputs from scratch sidesteps that instead of fighting
            it. Scoped to just this div, not the whole form, so it doesn't
            reset `languageState` and blow away the success/error message. */}
        <div key={currentLocale ?? locale} className="flex flex-col gap-2">
          <label className="flex items-center gap-1.5 text-[13px]">
            <input type="radio" name="locale" value="en" defaultChecked={languageChoice === "en"} onChange={() => setLanguageChoice("en")} />
            {t.english}
          </label>
          <label className="flex items-center gap-1.5 text-[13px]">
            <input type="radio" name="locale" value="cs" defaultChecked={languageChoice === "cs"} onChange={() => setLanguageChoice("cs")} />
            {t.czech}
          </label>
        </div>

        {languageState.error && <p className="text-sm text-warning">{languageState.error}</p>}
        {languageState.success && <p className="text-sm text-positive font-bold">{languageState.success}</p>}

        <button type="submit" disabled={languagePending} className="btn self-start mt-1">
          {languagePending ? t.saving : t.saveLanguage}
        </button>
      </form>
    </div>
  );
}
