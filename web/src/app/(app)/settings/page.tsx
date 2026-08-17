import { requireUser } from "@/lib/authz";

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <div>
      <h1 className="text-xl font-semibold border-b-2 border-ink pb-2 mb-4">Settings</h1>

      <div className="heading-label mb-1">Signed in as</div>
      <div className="text-sm mb-4">
        {user.name} <span className="placeholder-text">· {user.email} · {user.role}</span>
      </div>

      <p className="text-sm placeholder-text max-w-prose">
        Users & roles, company data, invoice template and connected accounts (Google Workspace, Calendar, ARES) land
        in a later phase.
      </p>
    </div>
  );
}
