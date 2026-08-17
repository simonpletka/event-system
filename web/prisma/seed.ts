import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

const DEV_PASSWORD = "changeme123";

function d(iso: string) {
  return new Date(iso);
}

async function main() {
  await prisma.invoice.deleteMany();
  await prisma.quote.deleteMany();
  await prisma.timeEntry.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.milestone.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.eventMember.deleteMany();
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);

  const admin = await prisma.user.create({
    data: {
      name: "Admin User",
      email: "admin@eventsystem.cz",
      passwordHash,
      role: "ADMIN",
    },
  });

  await prisma.user.create({
    data: {
      name: "Eva Kučerová",
      email: "eva.kucerova@eventsystem.cz",
      passwordHash,
      role: "ACCOUNTANT",
    },
  });

  const producer = await prisma.user.create({
    data: {
      name: "J. Novák",
      email: "jan.novak@eventsystem.cz",
      passwordHash,
      role: "PRODUCER",
      isCardHolder: true,
    },
  });

  const member = await prisma.user.create({
    data: {
      name: "M. Dvořák",
      email: "m.dvorak@eventsystem.cz",
      passwordHash,
      role: "MEMBER",
    },
  });

  // --- Autumn Conference — confirmed, upcoming, fully fleshed out ---
  await prisma.event.create({
    data: {
      title: "Autumn Conference 2026",
      brief:
        "Two-day corporate conference for Kobra a.s. — keynote, breakout tracks, evening reception on the boat.",
      clientName: "Petra Válková",
      clientPhone: "+420 771 220 118",
      clientEmail: "valkova@kobra.cz",
      companyName: "Kobra a.s.",
      companyAddress: "Vinohradská 12, Praha 2",
      companyIco: "27182904",
      companyDic: "CZ27182904",
      status: "CONFIRMED",
      buildDate: d("2026-09-03T08:00:00"),
      startDate: d("2026-09-04T09:00:00"),
      endDate: d("2026-09-06T22:00:00"),
      strikeDate: d("2026-09-06T22:00:00"),
      quotedValue: 340000,
      ownerId: producer.id,
      venues: {
        create: [
          {
            name: "O2 universum — hall A",
            address: "Českomoravská 2345/17, Praha 9",
            note: "main programme",
          },
          {
            name: "Loď Cargo",
            address: "Dvořákovo nábřeží, Praha 1",
            note: "afterparty, 5 Sep evening",
          },
        ],
      },
      milestones: {
        create: [
          { date: d("2026-08-20T10:00:00"), title: "Client call — run of show" },
          { date: d("2026-08-28T10:00:00"), title: "Tech walkthrough at venue" },
          { date: d("2026-09-03T08:00:00"), title: "Build day — crew call" },
        ],
      },
      members: { create: [{ userId: producer.id }, { userId: member.id }] },
      expenses: {
        create: [
          {
            paidById: producer.id,
            amount: 640,
            date: d("2026-08-10"),
            category: "TRAVEL_TAXI",
            note: "client meeting",
          },
          {
            paidById: producer.id,
            amount: 42000,
            date: d("2026-08-12"),
            category: "GEAR",
            note: "AV rental deposit",
          },
          {
            paidById: producer.id,
            amount: 3800,
            date: d("2026-08-14"),
            category: "FOOD",
            note: "crew catering — planning day",
          },
        ],
      },
      timeEntries: {
        create: [
          { userId: producer.id, minutes: 850, date: d("2026-08-15"), description: "Run of show planning" },
          { userId: member.id, minutes: 765, date: d("2026-08-15"), description: "Vendor coordination" },
        ],
      },
      quotes: {
        create: [{ number: "2026-Q31", total: 340000, status: "ACCEPTED", issuedAt: d("2026-07-20") }],
      },
      invoices: {
        create: [
          {
            number: "2026-0141",
            total: 340000,
            status: "ISSUED",
            dueDate: d("2026-09-20"),
            issuedAt: d("2026-09-06"),
          },
        ],
      },
    },
  });

  // --- Product launch — quote sent, waiting on client ---
  await prisma.event.create({
    data: {
      title: "Product launch",
      brief: "Nordika's autumn product launch — press + partner event.",
      clientName: "Tomáš Beneš",
      clientPhone: "+420 602 118 400",
      clientEmail: "benes@nordika.cz",
      companyName: "Nordika",
      companyAddress: "Lidická 20, Brno",
      companyIco: "05512244",
      companyDic: "CZ05512244",
      status: "QUOTE_SENT",
      startDate: d("2026-09-12T10:00:00"),
      endDate: d("2026-09-12T20:00:00"),
      quotedValue: 128000,
      ownerId: producer.id,
      members: { create: [{ userId: producer.id }] },
      milestones: {
        create: [{ date: d("2026-08-20T14:00:00"), title: "Client call 20 Aug" }],
      },
      quotes: {
        create: [{ number: "2026-Q34", total: 128000, status: "SENT", issuedAt: d("2026-08-14") }],
      },
    },
  });

  // --- Team offsite — in progress, member is assigned (tests role scoping) ---
  await prisma.event.create({
    data: {
      title: "Team offsite",
      brief: "Vela's internal team offsite — workshops + outdoor activities.",
      clientName: "Lucie Marešová",
      clientPhone: "+420 733 900 210",
      clientEmail: "maresova@vela.cz",
      companyName: "Vela s.r.o.",
      companyAddress: "Náměstí Míru 5, Praha 2",
      companyIco: "09984411",
      companyDic: "CZ09984411",
      status: "IN_PROGRESS",
      buildDate: d("2026-09-18T08:00:00"),
      startDate: d("2026-09-19T09:00:00"),
      endDate: d("2026-09-21T18:00:00"),
      quotedValue: 96000,
      ownerId: producer.id,
      venues: { create: [{ name: "Lipno resort", address: "Lipno nad Vltavou 250", note: "" }] },
      milestones: {
        create: [{ date: d("2026-08-25T11:00:00"), title: "Venue visit" }],
      },
      members: { create: [{ userId: producer.id }, { userId: member.id }] },
    },
  });

  // --- Summer Gala — ended, waiting to be invoiced (needs-attention tile) ---
  await prisma.event.create({
    data: {
      title: "Summer Gala",
      brief: "Aeris annual summer gala — 400 guests, dinner + live music.",
      clientName: "Radka Sýkorová",
      clientPhone: "+420 604 552 019",
      clientEmail: "sykorova@aeris.cz",
      companyName: "Aeris",
      companyAddress: "Karlovo náměstí 10, Praha 2",
      companyIco: "08812234",
      companyDic: "CZ08812234",
      status: "TO_INVOICE",
      startDate: d("2026-08-08T18:00:00"),
      endDate: d("2026-08-09T01:00:00"),
      quotedValue: 212000,
      ownerId: admin.id,
      members: { create: [{ userId: admin.id }] },
    },
  });

  // --- Dealer meeting — fresh inquiry, no commitments yet ---
  await prisma.event.create({
    data: {
      title: "Dealer meeting",
      brief: "Regional dealer meeting for Kobra a.s. — scope not yet confirmed.",
      clientName: "Petra Válková",
      clientPhone: "+420 771 220 118",
      clientEmail: "valkova@kobra.cz",
      companyName: "Kobra a.s.",
      companyAddress: "Vinohradská 12, Praha 2",
      companyIco: "27182904",
      companyDic: "CZ27182904",
      status: "INQUIRY",
      startDate: d("2026-10-02T09:00:00"),
      endDate: d("2026-10-02T17:00:00"),
      ownerId: producer.id,
      members: { create: [{ userId: producer.id }] },
    },
  });

  // --- Spring Kickoff — archived, closed and paid ---
  await prisma.event.create({
    data: {
      title: "Spring Kickoff",
      brief: "Nordika's spring kickoff event — completed and archived.",
      clientName: "Tomáš Beneš",
      clientPhone: "+420 602 118 400",
      clientEmail: "benes@nordika.cz",
      companyName: "Nordika",
      companyAddress: "Lidická 20, Brno",
      companyIco: "05512244",
      companyDic: "CZ05512244",
      status: "CLOSED",
      startDate: d("2026-03-14T09:00:00"),
      endDate: d("2026-03-14T18:00:00"),
      quotedValue: 180000,
      ownerId: admin.id,
      invoices: {
        create: [
          {
            number: "2026-0056",
            total: 180000,
            status: "PAID",
            dueDate: d("2026-03-28"),
            issuedAt: d("2026-03-15"),
          },
        ],
      },
    },
  });

  // --- extra invoice so the dashboard's "overdue" tile has real data ---
  const gala = await prisma.event.findFirstOrThrow({ where: { title: "Summer Gala" } });
  await prisma.invoice.create({
    data: {
      eventId: gala.id,
      number: "2026-0130",
      total: 76900,
      status: "OVERDUE",
      dueDate: d("2026-08-11"),
      issuedAt: d("2026-07-28"),
    },
  });

  console.log("Seeded 6 events, 4 users. Dev login password for all seed accounts:", DEV_PASSWORD);
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
