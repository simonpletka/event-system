import { requireUser } from "@/lib/authz";
import { Sidebar } from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="min-h-screen flex">
      <Sidebar userName={user.name ?? user.email ?? "Signed in"} />
      <main className="flex-1 min-w-0 px-6 py-5">{children}</main>
    </div>
  );
}
