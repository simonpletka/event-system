import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getLocale, getDictionary } from "@/lib/i18n";
import { LAST_EMAIL_COOKIE } from "@/lib/auth-cookies";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    // A deactivated account's cookie can still be present (see authz.ts requireUser
    // for why it isn't cleared) — only bounce onward if they're actually still active.
    const current = await prisma.user.findUnique({ where: { id: session.user.id }, select: { active: true } });
    if (current?.active) redirect("/dashboard");
  }

  const t = getDictionary(await getLocale());
  const jar = await cookies();
  const lastEmail = jar.get(LAST_EMAIL_COOKIE)?.value ?? "";

  return (
    <div className="min-h-dvh flex items-start justify-center px-4 pt-[18vh] sm:items-center sm:pt-0">
      <div className="w-full max-w-[360px]">
        <div className="text-[11px] font-bold tracking-[0.16em] mb-8">PROJECT SYSTEM</div>
        <h1 className="text-2xl font-semibold mb-6">{t.auth.signIn}</h1>
        <LoginForm t={t.auth} defaultEmail={lastEmail} />
      </div>
    </div>
  );
}
