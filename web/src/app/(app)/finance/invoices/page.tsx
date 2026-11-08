import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser, canManageFinance, canViewFinance } from "@/lib/authz";
import { getInvoiceList, getInvoiceKpis, type InvoiceListFilters } from "@/lib/queries/finance";
import { formatCurrency, formatCurrencyWithCzk, formatDate } from "@/lib/format";
import { toCzkBatch } from "@/lib/fx";
import { projectHref, clientHref } from "@/lib/slug";
import { InvoiceStatusPill } from "@/components/StatusPill";
import { DownloadPdfButton } from "@/components/finance/DownloadPdfButton";
import { FinanceSortMenu } from "@/components/finance/FinanceSortMenu";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { ChipLinks } from "@/components/ui/ChipLinks";
import { groupProjectOptions } from "@/lib/project-status";
import { MobileListRow } from "@/components/ui/MobileListRow";
import { getLocale, getDictionary, czCount, type Locale } from "@/lib/i18n";

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  if (!canViewFinance(user)) redirect("/finance/expenses");
  const params = await searchParams;
  const locale = await getLocale();
  const t = getDictionary(locale);
  const ti = t.finance.invoices;
  const filters: InvoiceListFilters = {
    bucket: (params.bucket as InvoiceListFilters["bucket"]) || undefined,
    projectId: params.projectId || undefined,
    sort: params.sort || undefined,
  };
  const carry = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ bucket: filters.bucket, projectId: filters.projectId, sort: filters.sort, ...over })) {
      if (v) p.set(k, v);
    }
    const qs = p.toString();
    return qs ? `/finance/invoices?${qs}` : "/finance/invoices";
  };
  const [{ invoices, total, projects }, kpis] = await Promise.all([
    getInvoiceList(user, filters),
    getInvoiceKpis(user),
  ]);
  const invoicesWithCzk = await toCzkBatch(invoices.map((inv) => ({ ...inv, amount: inv.total, date: inv.issuedAt })));
  const canManage = canManageFinance(user);

  const buckets: { key: NonNullable<InvoiceListFilters["bucket"]> | ""; label: string }[] = [
    { key: "", label: ti.bucketAll },
    { key: "issued", label: ti.bucketIssued },
    { key: "paid", label: ti.bucketPaid },
    { key: "overdue", label: ti.bucketOverdue },
    { key: "partly_paid", label: ti.bucketPartlyPaid },
  ];

  return (
    <div>
      <div className="flex justify-end gap-2">
        {canManage && (
          <>
            {/* Real navigation to a file-download API route, not a page — the catch-all
                route makes no-html-link-for-pages think otherwise. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/api/finance/invoices/export" className="btno">
              {ti.exportAccounting}
            </a>
            <Link href="/finance/invoices/new" className="btn font-semibold">
              {ti.newInvoice}
            </Link>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
        <KpiCell label={ti.kpiIssuedUnpaid} value={kpis.issuedUnpaid} locale={locale} />
        <KpiCell label={ti.kpiOverdue} value={kpis.overdue} attention locale={locale} />
        <KpiCell label={ti.kpiDue7} value={kpis.dueSoon} locale={locale} />
        <KpiCell label={ti.kpiPaidMonth} value={kpis.paidThisMonth} locale={locale} />
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap mt-4">
        <ChipLinks
          label={ti.colPayment}
          active={filters.bucket ?? ""}
          chips={buckets.map((b) => ({ key: b.key, label: b.label, href: carry({ bucket: b.key || undefined }) }))}
        />
        <div className="flex items-center gap-2 flex-wrap">
          <FilterSelect
            label={ti.projectFilter}
            value={filters.projectId ?? ""}
            groups={groupProjectOptions(projects, { active: t.finance.filters.activeProjects, inactive: t.finance.filters.pastProjects })}
            basePath="/finance/invoices"
            params={{ bucket: filters.bucket, sort: filters.sort }}
            paramName="projectId"
            searchable
            searchPlaceholder={t.finance.filters.searchProjects}
            emptyLabel={t.finance.filters.noMatches}
            anyLabel={t.finance.filters.anyProject}
          />
          <FinanceSortMenu
            current={filters.sort}
            basePath="/finance/invoices"
            params={{ bucket: filters.bucket, projectId: filters.projectId }}
            t={t.finance.sort}
          />
        </div>
      </div>

      <div className="hidden md:block card p-3 lg:p-4 mt-4">
        <div className="grid grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)_minmax(0,.9fr)_minmax(0,.6fr)_minmax(0,.6fr)_minmax(0,.9fr)_minmax(0,1fr)_minmax(0,.7fr)] gap-2.5 border-b border-ink/14 pb-1.5 px-3.5 [&_.heading-label]:font-bold [&_.heading-label]:!text-[9px]">
          <span className="heading-label">{ti.colNumber}</span>
          <span className="heading-label">{ti.colProject}</span>
          <span className="heading-label">{ti.colClient}</span>
          <span className="heading-label">{ti.colIssued}</span>
          <span className="heading-label">{ti.colDue}</span>
          <span className="heading-label">{ti.colTotal}</span>
          <span className="heading-label">{ti.colPayment}</span>
          <span className="heading-label">{ti.colPdf}</span>
        </div>

        {invoicesWithCzk.map((inv) => (
          <div
            key={inv.id}
            className="group grid grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)_minmax(0,.9fr)_minmax(0,.6fr)_minmax(0,.6fr)_minmax(0,.9fr)_minmax(0,1fr)_minmax(0,.7fr)] gap-2.5 items-center py-3.5 px-3.5 rounded-xl border-b border-ink/8 last:border-b-0 text-[15px] hover:bg-ink/5"
          >
            <Link href={`/finance/invoices/${inv.id}`} className="font-medium group-hover:text-accent">
              {inv.number}
            </Link>
            <Link href={projectHref(inv.project)} className="hover:text-accent">
              {inv.project.title}
            </Link>
            <div className="placeholder-text group-hover:!text-accent">
              {inv.project.clientId ? (
                <Link href={clientHref({ id: inv.project.clientId!, name: inv.project.companyName })} className="hover:text-accent">
                  {inv.project.companyName}
                </Link>
              ) : (
                inv.project.companyName
              )}
            </div>
            <div className="placeholder-text group-hover:!text-accent">{formatDate(inv.issuedAt)}</div>
            <div className="placeholder-text group-hover:!text-accent">{formatDate(inv.dueDate)}</div>
            <div className="font-semibold tabular-nums group-hover:text-accent">
              {formatCurrencyWithCzk(inv.total, inv.currency, inv.czkAmount)}
            </div>
            <div>
              <InvoiceStatusPill status={inv.status} dueDate={inv.dueDate} paidAt={inv.paidAt} t={t.invoicePill} />
            </div>
            <DownloadPdfButton pdfUrl={`/api/invoices/${inv.id}/pdf`} label={ti.download} subtle />
          </div>
        ))}
      </div>

      <div className="md:hidden flex flex-col gap-2 mt-4">
        {invoicesWithCzk.map((inv) => (
          <MobileListRow
            key={inv.id}
            href={`/finance/invoices/${inv.id}`}
            titleHref={projectHref(inv.project)}
            subLeft={inv.number}
            title={inv.project.title}
            tag={<InvoiceStatusPill status={inv.status} dueDate={inv.dueDate} paidAt={inv.paidAt} t={t.invoicePill} />}
            meta={`${inv.project.companyName} · ${ti.colIssued} ${formatDate(inv.issuedAt)} · ${ti.colDue} ${formatDate(inv.dueDate)}`}
            trailing={
              <>
                {formatCurrencyWithCzk(inv.total, inv.currency, inv.czkAmount)}
              </>
            }
          />
        ))}
      </div>

      {invoices.length === 0 && <p className="text-sm placeholder-text mt-4">{ti.noInvoicesMatch}</p>}

      <div className="flex justify-between mt-4 px-3.5">
        <div className="label">{ti.sortedByNote}</div>
        <div className="label">{ti.showingOfTotal(invoices.length, total)}</div>
      </div>
    </div>
  );
}

function KpiCell({
  label,
  value,
  attention,
  locale,
}: {
  label: string;
  value: { count: number; total: number };
  attention?: boolean;
  locale: Locale;
}) {
  const isWarning = attention && value.count > 0;
  const countLabel =
    locale === "cs"
      ? czCount(value.count, "1 faktura", `${value.count} faktury`, `${value.count} faktur`)
      : `${value.count} invoice${value.count === 1 ? "" : "s"}`;
  return (
    <div className={`card relative overflow-hidden px-5 py-4 ${isWarning ? "border-warning/30" : ""}`}>
      {isWarning && <div className="absolute top-0 left-0 right-0 h-0.5 bg-warning" />}
      <div className={`heading-label ${isWarning ? "text-warning" : ""}`}>{label}</div>
      <div className={`text-[18px] md:text-[26px] font-semibold tracking-tight mt-1 tabular-nums ${isWarning ? "text-warning" : ""}`}>{formatCurrency(value.total)}</div>
      <div className="placeholder-text text-[10px] mt-0.5">{countLabel}</div>
    </div>
  );
}
