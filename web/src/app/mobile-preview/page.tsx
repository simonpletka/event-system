import { notFound } from "next/navigation";
import { requireUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { clientHref, projectHref } from "@/lib/slug";
import { MobilePreview, type PreviewSection } from "@/components/mobile/MobilePreview";

/** Dev-only wall of phone-sized frames showing the real app, for tuning the mobile UI. */
export default async function MobilePreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  await requireUser();

  const [project, client, invoice, quote] = await Promise.all([
    prisma.project.findFirst({ where: { trips: { some: {} } } }).then((p) => p ?? prisma.project.findFirst()),
    prisma.client.findFirst(),
    prisma.invoice.findFirst(),
    prisma.quote.findFirst(),
  ]);
  const p = (suffix = "") => (project ? projectHref(project, suffix) : "/projects");

  const sections: PreviewSection[] = [
    { title: "Trips", screens: [{ label: "Trips", href: p("/trips") }] },
    { title: "Dashboard", screens: [{ label: "Dashboard", href: "/dashboard" }] },
    {
      title: "Projects",
      screens: [
        { label: "List", href: "/projects" },
        { label: "Overview", href: p() },
        { label: "Roadmap", href: p("/roadmap") },
        { label: "Finance", href: p("/finance") },
        { label: "Files", href: p("/files") },
        { label: "Edit", href: p("/edit") },
      ],
    },
    {
      title: "Clients",
      screens: [
        { label: "List", href: "/clients" },
        ...(client ? [{ label: "Detail", href: clientHref(client) }] : []),
      ],
    },
    {
      title: "Finance",
      screens: [
        { label: "Invoices", href: "/finance/invoices" },
        ...(invoice ? [{ label: "Invoice", href: `/finance/invoices/${invoice.id}` }] : []),
        { label: "New invoice", href: "/finance/invoices/new" },
        { label: "Quotes", href: "/finance/quotes" },
        ...(quote ? [{ label: "Quote", href: `/finance/quotes/${quote.id}` }] : []),
        { label: "Expenses", href: "/finance/expenses" },
        { label: "New expense", href: "/finance/expenses/new" },
        { label: "Reports", href: "/finance/reports" },
      ],
    },
    {
      title: "Time tracker",
      screens: [
        { label: "Tracking", href: "/time-tracker/tracking" },
        { label: "Overview", href: "/time-tracker/report" },
      ],
    },
    {
      title: "Meetings",
      screens: [
        { label: "List", href: "/meetings" },
        { label: "New", href: "/meetings/new" },
      ],
    },
    { title: "Settings", screens: [{ label: "Settings", href: "/settings" }] },
  ];

  return <MobilePreview sections={sections} />;
}
