"use client";

import { useActionState } from "react";
import Link from "next/link";
import { toggleCardHolderAction, resetPasswordAction, type SettingsFormState } from "@/lib/actions/settings";
import { getDictionary, type Dictionary, type Locale } from "@/lib/dictionary";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  customRoleId: string | null;
  active: boolean;
  isCardHolder: boolean;
  lastSeenAt: Date | null;
};

type T = Dictionary["settings"]["users"];
type TRoles = Dictionary["roles"];

function relativeTime(date: Date | null, t: T) {
  if (!date) return t.relativeNever;
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return t.relativeNow;
  if (minutes < 60) return t.relativeMinAgo(minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t.relativeHAgo(hours);
  const days = Math.floor(hours / 24);
  if (days === 1) return t.relativeYesterday;
  return t.relativeDAgo(days);
}

export function UsersTable({
  users,
  customRoles,
  currentUserId,
  locale,
  tRoles,
}: {
  users: User[];
  customRoles: { id: string; name: string }[];
  currentUserId: string;
  locale: Locale;
  tRoles: TRoles;
}) {
  const t = getDictionary(locale).settings.users;
  const customRoleName = new Map(customRoles.map((r) => [r.id, r.name]));
  const roleLabel: Record<string, string> = { ADMIN: tRoles.ADMIN, ACCOUNTANT: tRoles.ACCOUNTANT, PRODUCER: tRoles.PRODUCER, MEMBER: tRoles.MEMBER };

  return (
    <div>
      <div className="hidden md:grid grid-cols-[1.2fr_1.4fr_1fr_.7fr_.8fr_1fr] gap-2.5 border-b border-ink/14 pb-1.5 px-3.5">
        <span className="heading-label">{t.colName}</span>
        <span className="heading-label">{t.colAccount}</span>
        <span className="heading-label">{t.colRole}</span>
        <span className="heading-label">{t.colCompanyCard}</span>
        <span className="heading-label">{t.colLastSeen}</span>
        <span className="heading-label"></span>
      </div>
      {users.map((u) => (
        <UserRow
          key={u.id}
          user={u}
          roleLabel={u.customRoleId ? (customRoleName.get(u.customRoleId) ?? tRoles.custom) : roleLabel[u.role]}
          isSelf={u.id === currentUserId}
          lastSeenLabel={relativeTime(u.lastSeenAt, t)}
          t={t}
        />
      ))}
    </div>
  );
}

function UserRow({
  user,
  roleLabel,
  isSelf,
  lastSeenLabel,
  t,
}: {
  user: User;
  roleLabel: string;
  isSelf: boolean;
  lastSeenLabel: string;
  t: T;
}) {
  const [resetState, resetAction, resetPending] = useActionState<SettingsFormState, FormData>(resetPasswordAction, {});

  const cardToggle = (
    <form action={toggleCardHolderAction}>
      <input type="hidden" name="id" value={user.id} />
      <button type="submit" title={t.toggleCompanyCardTitle}>
        <span
          className={`w-[18px] h-[18px] rounded-[5px] border flex items-center justify-center ${
            user.isCardHolder ? "bg-accent border-accent" : "border-ink/25 bg-ink/4"
          }`}
        >
          {user.isCardHolder && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f3f2f2" strokeWidth="3">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          )}
        </span>
      </button>
    </form>
  );

  const actions = (
    <div className="flex gap-2.5 text-[9px] tracking-[0.1em] uppercase flex-wrap">
      <Link href={`/settings/users/${user.id}/edit`} className="placeholder-text hover:text-ink">
        {t.edit}
      </Link>
      <form action={resetAction}>
        <input type="hidden" name="id" value={user.id} />
        <button type="submit" disabled={resetPending} className="placeholder-text hover:text-ink">
          {t.resetPassword}
        </button>
      </form>
    </div>
  );

  return (
    <>
      <div
        className={`hidden md:grid grid-cols-[1.2fr_1.4fr_1fr_.7fr_.8fr_1fr] gap-2.5 items-center py-3 px-3.5 rounded-xl border-b border-ink/8 last:border-b-0 text-[13px] ${!user.active ? "opacity-50" : ""}`}
      >
        <div className="font-medium">
          {user.name}
          {isSelf && <span className="label ml-1.5">{t.youBadge}</span>}
          {!user.active && <span className="tag tag-warning ml-1.5">{t.inactiveBadge}</span>}
        </div>
        <div className="placeholder-text truncate">{user.email}</div>
        <div className="placeholder-text">{roleLabel}</div>
        {cardToggle}
        <div className="placeholder-text">{lastSeenLabel}</div>
        {actions}
        {resetState.success && <div className="col-span-6 text-[11px] text-positive font-bold border border-ink/25 rounded-lg p-2 mt-1">{resetState.success}</div>}
      </div>

      <div className={`md:hidden py-3 px-3.5 rounded-xl border-b border-ink/8 last:border-b-0 text-[13px] ${!user.active ? "opacity-50" : ""}`}>
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0">
            <div className="font-medium">
              {user.name}
              {isSelf && <span className="label ml-1.5">{t.youBadge}</span>}
              {!user.active && <span className="tag tag-warning ml-1.5">{t.inactiveBadge}</span>}
            </div>
            <div className="placeholder-text text-[11.5px] mt-0.5">{user.email}</div>
            <div className="placeholder-text text-[11.5px] mt-0.5">
              {roleLabel} · {lastSeenLabel}
            </div>
          </div>
          {cardToggle}
        </div>
        <div className="mt-2.5">{actions}</div>
        {resetState.success && <div className="text-[11px] text-positive font-bold border border-ink/25 rounded-lg p-2 mt-2">{resetState.success}</div>}
      </div>
    </>
  );
}
