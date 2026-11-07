import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { requireUser, isAdmin } from "@/lib/authz";
import { getLocale, getDictionary } from "@/lib/i18n";
import { validateAuthorizeRequest } from "@/lib/agent/authorize";
import { decideAuthorizationAction } from "@/lib/actions/oauth";

/**
 * OAuth consent screen for the Claude connector. claude.ai opens this in a
 * browser (on a phone too); an Admin signs in if needed (bounced back here
 * via /login?next=) and approves. Approving issues a token for the "Claude"
 * service account, not for the Admin themselves.
 */
export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const raw = await searchParams;
  const session = await auth();
  if (!session?.user) {
    const query = new URLSearchParams(Object.entries(raw).filter((e): e is [string, string] => typeof e[1] === "string"));
    redirect(`/login?next=${encodeURIComponent(`/oauth/authorize?${query}`)}`);
  }
  const user = await requireUser();
  const t = getDictionary(await getLocale()).connector;
  const checked = await validateAuthorizeRequest(raw);

  return (
    <div className="min-h-dvh flex items-start justify-center px-4 pt-[12vh] pb-12 sm:items-center sm:pt-0">
      <div className="w-full max-w-[420px]">
        <div className="text-[11px] font-bold tracking-[0.16em] mb-8">{t.eyebrow}</div>
        {"error" in checked ? (
          <>
            <h1 className="text-2xl font-semibold mb-3">{t.invalidRequest}</h1>
            <p className="text-sm opacity-70">{checked.error}</p>
          </>
        ) : !isAdmin(user) ? (
          <>
            <h1 className="text-2xl font-semibold mb-3">{t.title}</h1>
            <p className="text-sm opacity-70">{t.adminOnly}</p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold mb-3">{t.title}</h1>
            <p className="text-sm opacity-80 mb-6">{t.intro(checked.client.name)}</p>

            <div className="card p-4 mb-3">
              <div className="heading-label mb-2">{t.canHeading}</div>
              <ul className="text-sm flex flex-col gap-1.5">
                {t.can.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span className="text-positive">✓</span>
                    {line}
                  </li>
                ))}
              </ul>
            </div>
            <div className="card p-4 mb-4">
              <div className="heading-label mb-2">{t.cannotHeading}</div>
              <ul className="text-sm flex flex-col gap-1.5">
                {t.cannot.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span className="text-warning">✕</span>
                    {line}
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-xs opacity-60 mb-6">{t.revokeHint}</p>

            <form action={decideAuthorizationAction} className="flex gap-3">
              <input type="hidden" name="response_type" value="code" />
              <input type="hidden" name="client_id" value={checked.params.clientId} />
              <input type="hidden" name="redirect_uri" value={checked.params.redirectUri} />
              <input type="hidden" name="code_challenge" value={checked.params.codeChallenge} />
              <input type="hidden" name="code_challenge_method" value="S256" />
              <input type="hidden" name="state" value={checked.params.state} />
              <button type="submit" name="decision" value="approve" className="btn flex-1">
                {t.approve}
              </button>
              <button type="submit" name="decision" value="deny" className="btno flex-1">
                {t.deny}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
