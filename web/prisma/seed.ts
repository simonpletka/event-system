import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { addDemoData, DEMO_PASSWORD } from "../src/lib/demo-data";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

// Wipes the database and fills it with the demo dataset. The app's testing
// view doesn't need this: it builds its own copy (see src/lib/data-mode.ts).
async function main() {
  // Newer tables first: they point at users/projects the lines below delete.
  await prisma.oAuthToken.deleteMany();
  await prisma.oAuthCode.deleteMany();
  await prisma.oAuthClient.deleteMany();
  await prisma.gearReservation.deleteMany();
  await prisma.gearGroup.deleteMany();
  await prisma.gearType.deleteMany();
  await prisma.gearCategory.deleteMany();
  await prisma.projectFile.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.meeting.deleteMany();
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
  await prisma.companySettings.deleteMany();
  await prisma.itemCategory.deleteMany();

  await addDemoData(prisma);

  console.log("Seeded 15 projects, 6 clients, 4 users, company settings. Dev login password for all seed accounts:", DEMO_PASSWORD);
  console.log("  admin@eventsystem.cz (Admin)");
  console.log("  eva.kucerova@eventsystem.cz (Accountant)");
  console.log("  jan.novak@eventsystem.cz (Producer)");
  console.log("  m.dvorak@eventsystem.cz (Member)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
