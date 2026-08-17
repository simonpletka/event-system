"use client";

import { useRef } from "react";
import { useActionState } from "react";
import { updateUserRoleAction, toggleCardHolderAction, resetPasswordAction, type SettingsFormState } from "@/lib/actions/settings";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  isCardHolder: boolean;
  lastSeenAt: Date | null;
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

export function UsersTable({ users, currentUserId }: { users: User[]; currentUserId: string }) {
  return (
    <div>
      <div className="grid grid-cols-[1.2fr_1.4fr_.9fr_.7fr_.8fr_.7fr] gap-2.5 border-b-2 border-ink pb-1.5">
        <span className="heading-label">Name</span>
        <span className="heading-label">Account</span>
        <span className="heading-label">Role</span>
        <span className="heading-label">Company card</span>
        <span className="heading-label">Last seen</span>
        <span className="heading-label"></span>
      </div>
      {users.map((u) => (
        <UserRow key={u.id} user={u} isSelf={u.id === currentUserId} lastSeenLabel={relativeTime(u.lastSeenAt)} />
      ))}
    </div>
  );
}

function UserRow({ user, isSelf, lastSeenLabel }: { user: User; isSelf: boolean; lastSeenLabel: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [resetState, resetAction, resetPending] = useActionState<SettingsFormState, FormData>(resetPasswordAction, {});

  return (
    <div className="grid grid-cols-[1.2fr_1.4fr_.9fr_.7fr_.8fr_.7fr] gap-2.5 items-center py-2.5 border-b border-ink/13 text-[13px]">
      <div>{user.name}</div>
      <div className="placeholder-text truncate">{user.email}</div>
      <form ref={formRef} action={updateUserRoleAction}>
        <input type="hidden" name="id" value={user.id} />
        <select
          name="role"
          defaultValue={user.role}
          disabled={isSelf}
          onChange={() => formRef.current?.requestSubmit()}
          className="pill bg-transparent"
          title={isSelf ? "You can't change your own role" : undefined}
        >
          <option value="ADMIN">Admin</option>
          <option value="ACCOUNTANT">Accountant</option>
          <option value="PRODUCER">Producer</option>
          <option value="MEMBER">Member</option>
        </select>
      </form>
      <form action={toggleCardHolderAction}>
        <input type="hidden" name="id" value={user.id} />
        <button type="submit" className="text-[13px] hover:text-accent" title="Toggle company card">
          {user.isCardHolder ? "✓" : "—"}
        </button>
      </form>
      <div className="placeholder-text">{lastSeenLabel}</div>
      <form action={resetAction}>
        <input type="hidden" name="id" value={user.id} />
        <button type="submit" disabled={resetPending} className="text-[9px] tracking-[0.1em] uppercase placeholder-text hover:text-ink">
          Reset password
        </button>
      </form>
      {resetState.success && <div className="col-span-6 text-[11px] border border-ink/25 p-1.5 mt-1">{resetState.success}</div>}
    </div>
  );
}
