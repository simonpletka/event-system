"use client";

import { useActionState } from "react";
import Link from "next/link";
import { toggleCardHolderAction, resetPasswordAction, type SettingsFormState } from "@/lib/actions/settings";

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

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  ACCOUNTANT: "Accountant",
  PRODUCER: "Producer",
  MEMBER: "Member",
};

function relativeTime(date: Date | null) {
  if (!date) return "never";
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  return `${days} d ago`;
}

export function UsersTable({
  users,
  customRoles,
  currentUserId,
}: {
  users: User[];
  customRoles: { id: string; name: string }[];
  currentUserId: string;
}) {
  const customRoleName = new Map(customRoles.map((r) => [r.id, r.name]));

  return (
    <div>
      <div className="grid grid-cols-[1.2fr_1.4fr_1fr_.7fr_.8fr_1fr] gap-2.5 border-b border-ink/14 pb-1.5 px-3.5">
        <span className="heading-label">Name</span>
        <span className="heading-label">Account</span>
        <span className="heading-label">Role</span>
        <span className="heading-label">Company card</span>
        <span className="heading-label">Last seen</span>
        <span className="heading-label"></span>
      </div>
      {users.map((u) => (
        <UserRow
          key={u.id}
          user={u}
          roleLabel={u.customRoleId ? (customRoleName.get(u.customRoleId) ?? "Custom") : ROLE_LABEL[u.role]}
          isSelf={u.id === currentUserId}
          lastSeenLabel={relativeTime(u.lastSeenAt)}
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
}: {
  user: User;
  roleLabel: string;
  isSelf: boolean;
  lastSeenLabel: string;
}) {
  const [resetState, resetAction, resetPending] = useActionState<SettingsFormState, FormData>(resetPasswordAction, {});

  return (
    <div
      className={`grid grid-cols-[1.2fr_1.4fr_1fr_.7fr_.8fr_1fr] gap-2.5 items-center py-3 px-3.5 rounded-xl border-b border-ink/8 last:border-b-0 text-[13px] ${!user.active ? "opacity-50" : ""}`}
    >
      <div className="font-medium">
        {user.name}
        {isSelf && <span className="label ml-1.5">you</span>}
        {!user.active && <span className="tag tag-warning ml-1.5">Inactive</span>}
      </div>
      <div className="placeholder-text truncate">{user.email}</div>
      <div className="placeholder-text">{roleLabel}</div>
      <form action={toggleCardHolderAction}>
        <input type="hidden" name="id" value={user.id} />
        <button type="submit" title="Toggle company card">
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
      <div className="placeholder-text">{lastSeenLabel}</div>
      <div className="flex gap-2.5 text-[9px] tracking-[0.1em] uppercase flex-wrap">
        <Link href={`/settings/users/${user.id}/edit`} className="placeholder-text hover:text-ink">
          Edit
        </Link>
        <form action={resetAction}>
          <input type="hidden" name="id" value={user.id} />
          <button type="submit" disabled={resetPending} className="placeholder-text hover:text-ink">
            Reset password
          </button>
        </form>
      </div>
      {resetState.success && <div className="col-span-6 text-[11px] border border-ink/25 rounded-lg p-2 mt-1">{resetState.success}</div>}
    </div>
  );
}
