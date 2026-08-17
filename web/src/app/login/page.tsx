import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-[360px]">
        <div className="text-[11px] font-bold tracking-[0.16em] mb-8">EVENT SYSTEM</div>
        <h1 className="text-2xl font-semibold mb-1">Sign in</h1>
        <p className="text-sm placeholder-text mb-6">Accounts are created by an administrator — no public registration.</p>
        <LoginForm />
      </div>
    </div>
  );
}
