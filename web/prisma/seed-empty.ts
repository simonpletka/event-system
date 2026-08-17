import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

const ADMIN_EMAIL = "admin@eventsystem.cz";
const ADMIN_PASSWORD = "changeme123";

/**
 * Blank-slate seed for testing against real data — wipes every table the
 * same way prisma/seed.ts does (plus CustomRole, which that script never
 * clears), then creates a single Admin login and nothing else: no events,
 * quotes, invoices, expenses, time entries or company settings. Everything
 * from here on is entered through the app itself — Settings > Company for
 * the real company profile, Settings > Users for real accounts, etc.
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
  await prisma.milestone.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.eventMember.deleteMany();
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();
  await prisma.customRole.deleteMany();
  await prisma.companySettings.deleteMany();

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await prisma.user.create({
    data: { name: "Admin", email: ADMIN_EMAIL, passwordHash, role: "ADMIN" },
  });

  console.log("Seeded an empty database — no events, quotes, invoices, expenses, time entries or company settings.");
  console.log(`  Log in as ${ADMIN_EMAIL} (password: ${ADMIN_PASSWORD}), then fill in Settings > Company and add real users/events from there.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
