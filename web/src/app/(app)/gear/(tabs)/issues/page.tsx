import Link from "next/link";
import { requireUser, canManageGear } from "@/lib/authz";
import { getLocale, getDictionary } from "@/lib/i18n";
import { getGearIssues, type IssueFilter } from "@/lib/queries/gear-ops";
import { formatPragueDate } from "@/lib/prague-date";
import { formatCurrency } from "@/lib/format";
import { ChipLinks } from "@/components/ui/ChipLinks";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConditionChip } from "@/components/gear/ConditionChip";

const STATUS_KEYS = ["open", "all", "OPEN", "IN_SERVICE", "RESOLVED", "WONT_FIX"] as const;
const SEVERITY_KEYS = ["all", "MINOR", "MAJOR", "UNUSABLE"] as const;

/** Problems reported across all gear, newest first; each opens its unit's page. */
export default async function GearIssuesPage({ searchParams }: { searchParams: Promise<{ status?: string; severity?: string }> }) {
  const user = await requireUser();
  const locale = await getLocale();
  const t = getDictionary(locale).gear;
  const q = await searchParams;
  const status = (STATUS_KEYS as readonly string[]).includes(q.status ?? "") ? (q.status as IssueFilter["status"]) : "open";
  const severity = (SEVERITY_KEYS as readonly string[]).includes(q.severity ?? "") ? (q.severity as IssueFilter["severity"]) : "all";
  const issues = await getGearIssues({ status, severity });
  const canManage = canManageGear(user);
  const href = (s: string, v: string) => {
    const p = new URLSearchParams();
    if (s !== "open") p.set("status", s);
    if (v !== "all") p.set("severity", v);
    const qs = p.toString();
    return qs ? `/gear/issues?${qs}` : "/gear/issues";
  };
  const when = (iso: string) => formatPragueDate(iso, locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <ChipLinks
          label={t.issueStatusLabel}
          active={status}
          chips={[
            { key: "open", label: t.filterOpen, href: href("open", severity) },
            ...(["OPEN", "IN_SERVICE", "RESOLVED", "WONT_FIX"] as const).map((s) => ({ key: s, label: t.issueStatus[s], href: href(s, severity) })),
            { key: "all", label: t.filterAllStatuses, href: href("all", severity) },
          ]}
        />
        <ChipLinks
          label={t.severityLabel}
          active={severity}
          chips={[
            { key: "all", label: t.filterAllSeverities, href: href(status, "all") },
            ...(["MINOR", "MAJOR", "UNUSABLE"] as const).map((s) => ({ key: s, label: t.severity[s], href: href(status, s) })),
          ]}
        />
      </div>

      {issues.length === 0 ? (
        <EmptyState message={status === "open" && severity === "all" ? t.issuesOpenNone : t.issuesEmpty} />
      ) : (
        <section aria-label={t.tabIssues} className="card p-2 md:p-3">
          <ul>
            {issues.map((i) => (
              <li key={i.id} className="border-t border-ink/8 first:border-t-0">
                <Link href={`/g/${i.unit.code}`} className="group flex flex-col gap-1.5 px-3 py-3.5 rounded-xl hover:bg-ink/5">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-semibold group-hover:text-accent">
                      {i.unit.typeName} #{i.unit.number}
                    </span>
                    <span className={`tag ${i.severity === "UNUSABLE" ? "tag-warning" : i.severity === "MAJOR" ? "tag-attention" : "tag-neutral"}`}>{t.severity[i.severity]}</span>
                    <span className={`tag ${i.status === "RESOLVED" ? "tag-positive" : i.status === "WONT_FIX" ? "tag-neutral" : "tag-attention"}`}>{t.issueStatus[i.status]}</span>
                    {i.unit.condition !== "OK" && <ConditionChip condition={i.unit.condition} locale={locale} />}
                  </span>
                  <span className="text-[14px] line-clamp-2">{i.description}</span>
                  <span className="text-[12px] placeholder-text">
                    {t.reportedBy(i.reportedBy ?? "?", when(i.reportedAt))}
                    {i.project ? ` · ${t.onProject(`${i.project.number} ${i.project.title}`)}` : ""}
                    {i.photos > 0 ? ` · ${t.photosCount(i.photos)}` : ""}
                    {canManage && i.repairCost != null ? ` · ${formatCurrency(i.repairCost)}` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
