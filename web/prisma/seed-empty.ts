import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

const ADMIN_EMAIL = "admin@eventsystem.cz";
const ADMIN_PASSWORD = "changeme123";

const DEFAULT_CATEGORIES = ["Video", "Audio", "Rigging", "People", "Other"];

/**
 * Blank-slate seed for testing against real data — wipes every table the
 * same way prisma/seed.ts does (plus CustomRole, which that script never
 * clears), then creates a single Admin login and nothing else: no projects,
 * quotes, invoices, expenses, time entries or company settings. Everything
 * from here on is entered through the app itself — Settings > Company for
 * the real company profile, Settings > Users for real accounts, etc.
 * Default line-item categories ARE seeded here (Video/Audio/Rigging/People/
 * Other) since those are app configuration, not demo data — Settings >
 * Categories lets them be renamed/added/deleted afterward.
 */
async function main() {
  await prisma.invoiceEvent.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.quoteItem.deleteMany();
  await prisma.quote.deleteMany();
  await prisma.timeEntry.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.roadmapItem.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.projectContact.deleteMany();
  await prisma.project.deleteMany();
  await prisma.clientContact.deleteMany();
  await prisma.client.deleteMany();
  await prisma.user.deleteMany();
  await prisma.customRole.deleteMany();
  await prisma.companySettings.deleteMany();
  await prisma.itemCategory.deleteMany();

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await prisma.user.create({
    data: { name: "Admin", email: ADMIN_EMAIL, passwordHash, role: "ADMIN" },
  });
  await prisma.itemCategory.createMany({
    data: DEFAULT_CATEGORIES.map((name, sortOrder) => ({ name, sortOrder })),
  });

  console.log("Seeded an empty database — no projects, quotes, invoices, expenses, time entries or company settings.");
  console.log(`  Log in as ${ADMIN_EMAIL} (password: ${ADMIN_PASSWORD}), then fill in Settings > Company and add real users/projects from there.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
