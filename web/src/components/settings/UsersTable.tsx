"use client";

import { useRef } from "react";
import { useActionState } from "react";
import Link from "next/link";
import {
  assignRoleAction,
  toggleCardHolderAction,
  resetPasswordAction,
  deactivateUserAction,
  reactivateUserAction,
  type SettingsFormState,
} from "@/lib/actions/settings";
import { RoleSelect } from "./RoleSelect";

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
  return (
    <div>
      <div className="grid grid-cols-[1.2fr_1.4fr_1.1fr_.7fr_.8fr_1fr] gap-2.5 border-b-2 border-ink pb-1.5">
        <span className="heading-label">Name</span>
        <span className="heading-label">Account</span>
        <span className="heading-label">Role</span>
        <span className="heading-label">Company card</span>
        <span className="heading-label">Last seen</span>
        <span className="heading-label"></span>
      </div>
      {users.map((u) => (
        <UserRow key={u.id} user={u} customRoles={customRoles} isSelf={u.id === currentUserId} lastSeenLabel={relativeTime(u.lastSeenAt)} />
      ))}
    </div>
  );
}

function UserRow({
  user,
  customRoles,
  isSelf,
  lastSeenLabel,
}: {
  user: User;
  customRoles: { id: string; name: string }[];
  isSelf: boolean;
  lastSeenLabel: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [resetState, resetAction, resetPending] = useActionState<SettingsFormState, FormData>(resetPasswordAction, {});
  const roleValue = user.customRoleId ? `CUSTOM:${user.customRoleId}` : `ROLE:${user.role}`;

  return (
    <div className={`grid grid-cols-[1.2fr_1.4fr_1.1fr_.7fr_.8fr_1fr] gap-2.5 items-center py-2.5 border-b border-ink/13 text-[13px] ${!user.active ? "opacity-50" : ""}`}>
      <div>
        {user.name}
        {!user.active && <span className="pill pill-red ml-1.5">Inactive</span>}
      </div>
      <div className="placeholder-text truncate">{user.email}</div>
      <form ref={formRef} action={assignRoleAction}>
        <input type="hidden" name="id" value={user.id} />
        <RoleSelect
          name="role"
          defaultValue={roleValue}
          customRoles={customRoles}
          disabled={isSelf}
          onChange={() => formRef.current?.requestSubmit()}
          className="pill bg-transparent"
        />
      </form>
      <form action={toggleCardHolderAction}>
        <input type="hidden" name="id" value={user.id} />
        <button type="submit" className="text-[13px] hover:text-accent" title="Toggle company card">
          {user.isCardHolder ? "✓" : "—"}
        </button>
      </form>
      <div className="placeholder-text">{lastSeenLabel}</div>
      <div className="flex gap-2 text-[9px] tracking-[0.1em] uppercase flex-wrap">
        <Link href={`/settings/users/${user.id}/edit`} className="placeholder-text hover:text-ink">
          Edit
        </Link>
        <form action={resetAction}>
          <input type="hidden" name="id" value={user.id} />
          <button type="submit" disabled={resetPending} className="placeholder-text hover:text-ink">
            Reset password
          </button>
        </form>
        {!isSelf &&
          (user.active ? (
            <DeactivateButton id={user.id} />
          ) : (
            <form action={reactivateUserAction}>
              <input type="hidden" name="id" value={user.id} />
              <button type="submit" className="placeholder-text hover:text-ink">
                Reactivate
              </button>
            </form>
          ))}
      </div>
      {resetState.success && <div className="col-span-6 text-[11px] border border-ink/25 p-1.5 mt-1">{resetState.success}</div>}
    </div>
  );
}

function DeactivateButton({ id }: { id: string }) {
  return (
    <form
      action={deactivateUserAction}
      onSubmit={(e) => {
        if (!confirm("Deactivate this account? They won't be able to log in, but their past records stay intact.")) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="placeholder-text hover:text-accent">
        Deactivate
      </button>
    </form>
  );
}
