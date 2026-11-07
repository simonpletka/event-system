import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/format";
import { revokeConnectionAction } from "@/lib/actions/oauth";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import type { Dictionary } from "@/lib/dictionary";

/**
 * Settings → Claude (Admin only): how to add the connector on claude.ai, and
 * every live connection with a Revoke button. A "connection" is one OAuth
 * client; its refresh-token rotations are collapsed into a single row.
 */
export async function ConnectorTab({ t }: { t: Dictionary["connector"] }) {
  const h = await headers();
  const base =
    process.env.APP_BASE_URL?.replace(/\/$/, "") ??
    `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`;

  const live = await prisma.oAuthToken.findMany({
    where: { revokedAt: null, refreshExpiresAt: { gt: new Date() } },
    include: { client: true, approvedBy: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
  const byClient = new Map<string, { name: string; approvedBy: string; connectedAt: Date; lastUsedAt: Date | null }>();
  for (const tok of live) {
    const prev = byClient.get(tok.clientId);
    const lastUsed = [prev?.lastUsedAt, tok.lastUsedAt].filter((x): x is Date => !!x).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
    byClient.set(tok.clientId, {
      name: tok.client.name,
      approvedBy: tok.approvedBy.name,
      connectedAt: prev?.connectedAt ?? tok.client.createdAt,
      lastUsedAt: lastUsed,
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm opacity-80">{t.settingsIntro}</p>

      <div className="card p-4">
        <div className="heading-label mb-2">{t.serverUrl}</div>
        <code className="block text-sm break-all select-all">{base}/api/mcp</code>
        <ol className="list-decimal pl-5 mt-4 text-sm flex flex-col gap-1.5 opacity-80">
          {t.setupSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>

      <div>
        <div className="heading-label mb-2">{t.connectionsHeading}</div>
        {byClient.size === 0 ? (
          <p className="text-sm opacity-60">{t.noConnections}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {[...byClient.entries()].map(([clientId, c]) => (
              <li key={clientId} className="card p-4 flex items-center justify-between gap-4">
                <div className="text-sm min-w-0">
                  <div className="font-semibold">{c.name}</div>
                  <div className="opacity-60 text-xs mt-1">
                    {t.approvedBy} {c.approvedBy} · {t.connectedAt} {formatDateTime(c.connectedAt)} · {t.lastUsed}{" "}
                    {c.lastUsedAt ? formatDateTime(c.lastUsedAt) : t.never}
                  </div>
                </div>
                <ConfirmDeleteButton
                  action={revokeConnectionAction}
                  fields={{ clientId }}
                  confirmMessage={t.revokeConfirm}
                  label={t.revoke}
                  pendingLabel="…"
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
