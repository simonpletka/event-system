import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getLocale, getDictionary } from "@/lib/i18n";
import { LAST_EMAIL_COOKIE, safeNextPath } from "@/lib/auth-cookies";
import { LogoMark } from "@/components/ui/Logo";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNextPath((await searchParams).next);
  const session = await auth();
  if (session?.user) {
    // A deactivated account's cookie can still be present (see authz.ts requireUser
    // for why it isn't cleared) — only bounce onward if they're actually still active.
    const current = await prisma.user.findUnique({ where: { id: session.user.id }, select: { active: true } });
    if (current?.active) redirect(next);
  }

  const t = getDictionary(await getLocale());
  const jar = await cookies();
  const lastEmail = jar.get(LAST_EMAIL_COOKIE)?.value ?? "";

  return (
    <div className="min-h-dvh flex flex-col items-center justify-start px-4 pt-[12vh] pb-10 sm:justify-center sm:pt-10">
      <div className="w-full max-w-[400px]">
        <div className="flex flex-col items-center text-center mb-7">
          <LogoMark
            size={56}
            style={{ filter: "drop-shadow(0 10px 28px color-mix(in srgb, var(--color-accent) 45%, transparent))" }}
          />
          <div className="mt-5 text-[11px] font-bold tracking-[0.16em]">PROJECT SYSTEM</div>
        </div>

        <div className="card !rounded-[22px] p-6 sm:p-8 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
          <h1 className="text-2xl font-semibold">{t.auth.welcome}</h1>
          <p className="text-sm placeholder-text mt-1.5 mb-6">{t.auth.subtitle}</p>
          <LoginForm t={t.auth} defaultEmail={lastEmail} next={next} />
        </div>
      </div>
    </div>
  );
}
