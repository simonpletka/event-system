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

type ItemInput = { description: string; quantity?: number; unitPrice: number; vatRate?: number };

function withTotal(items: ItemInput[]) {
  const total = Math.round(
    items.reduce((sum, i) => sum + (i.quantity ?? 1) * i.unitPrice * (1 + (i.vatRate ?? 21) / 100), 0)
  );
  return {
    total,
    items: {
      create: items.map((i, idx) => ({
        description: i.description,
        quantity: i.quantity ?? 1,
        unitPrice: i.unitPrice,
        vatRate: i.vatRate ?? 21,
        sortOrder: idx,
      })),
    },
  };
}

function variableSymbol(number: string) {
  return number.replace(/\D/g, "");
}

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
  await prisma.companySettings.deleteMany();

  await prisma.companySettings.create({
    data: {
      id: "singleton",
      name: "Agency s.r.o.",
      address: "Křižíkova 34, Praha 8",
      ico: "09112233",
      dic: "CZ09112233",
      isVatPayer: true,
      bankAccount: "CZ6503000000001234567890",
      defaultDueDays: 14,
    },
  });

  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);

  const admin = await prisma.user.create({
    data: { name: "Admin User", email: "admin@eventsystem.cz", passwordHash, role: "ADMIN" },
  });

  const accountant = await prisma.user.create({
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
    data: { name: "M. Dvořák", email: "m.dvorak@eventsystem.cz", passwordHash, role: "MEMBER" },
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
          { name: "O2 universum — hall A", address: "Českomoravská 2345/17, Praha 9", note: "main programme" },
          { name: "Loď Cargo", address: "Dvořákovo nábřeží, Praha 1", note: "afterparty, 5 Sep evening" },
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
          { paidById: producer.id, amount: 640, date: d("2026-08-10"), category: "TRAVEL_TAXI", note: "client meeting" },
          { paidById: producer.id, amount: 42000, date: d("2026-08-12"), category: "GEAR", note: "AV rental deposit" },
          { paidById: producer.id, amount: 3800, date: d("2026-08-14"), category: "FOOD", note: "crew catering — planning day" },
        ],
      },
      timeEntries: {
        create: [
          { userId: producer.id, minutes: 850, date: d("2026-08-15"), description: "Run of show planning" },
          { userId: member.id, minutes: 765, date: d("2026-08-15"), description: "Vendor coordination" },
        ],
      },
      quotes: {
        create: [
          {
            number: "2026-Q31",
            status: "ACCEPTED",
            validUntil: d("2026-08-15"),
            issuedAt: d("2026-07-28"),
            ...withTotal([
              { description: "Production management — Autumn Conference", unitPrice: 250000 },
              { description: "Stage & light rental", unitPrice: 60000 },
              { description: "Crew — build day", quantity: 6, unitPrice: 5000 },
            ]),
          },
        ],
      },
    },
  });

  const autumn = await prisma.event.findFirstOrThrow({ where: { title: "Autumn Conference 2026" } });
  const autumnQuote = await prisma.quote.findFirstOrThrow({ where: { eventId: autumn.id } });
  const autumnInvoiceData = withTotal([
    { description: "Production management — Autumn Conference", unitPrice: 250000 },
    { description: "Stage & light rental", unitPrice: 60000 },
    { description: "Crew — build day", quantity: 6, unitPrice: 5000 },
  ]);
  await prisma.invoice.create({
    data: {
      eventId: autumn.id,
      quoteId: autumnQuote.id,
      number: "2026-0141",
      variableSymbol: variableSymbol("2026-0141"),
      status: "PARTLY_PAID",
      dueDate: d("2026-09-20"),
      issuedAt: d("2026-08-05"),
      amountPaid: Math.round(autumnInvoiceData.total / 2),
      ...autumnInvoiceData,
      payments: {
        create: [
          {
            amount: Math.round(autumnInvoiceData.total / 2),
            date: d("2026-08-12"),
            note: "Bank transfer — first instalment",
            recordedById: producer.id,
          },
        ],
      },
      history: {
        create: [
          { type: "CREATED", message: "Created from quote 2026-Q31", createdAt: d("2026-08-04"), userId: producer.id },
          { type: "ISSUED", message: "Issued and sent — J. Novák", createdAt: d("2026-08-05"), userId: producer.id },
          {
            type: "PAYMENT_RECORDED",
            message: "Partial payment recorded — J. Novák",
            createdAt: d("2026-08-12"),
            userId: producer.id,
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
      milestones: { create: [{ date: d("2026-08-20T14:00:00"), title: "Client call 20 Aug" }] },
      quotes: {
        create: [
          {
            number: "2026-Q34",
            status: "SENT",
            validUntil: d("2026-08-31"),
            issuedAt: d("2026-08-14"),
            ...withTotal([
              { description: "Production management — Product launch", unitPrice: 88000 },
              { description: "Press kit & signage", unitPrice: 40000 },
            ]),
          },
        ],
      },
    },
  });

  // --- Team offsite — in progress, member is assigned; deposit paid, balance due soon ---
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
      milestones: { create: [{ date: d("2026-08-25T11:00:00"), title: "Venue visit" }] },
      members: { create: [{ userId: producer.id }, { userId: member.id }] },
      quotes: {
        create: [
          {
            number: "2026-Q35",
            status: "ACCEPTED",
            validUntil: d("2026-08-10"),
            issuedAt: d("2026-07-25"),
            ...withTotal([{ description: "Team offsite — full package", unitPrice: 96000 }]),
          },
        ],
      },
    },
  });

  const offsite = await prisma.event.findFirstOrThrow({ where: { title: "Team offsite" } });
  const offsiteQuote = await prisma.quote.findFirstOrThrow({ where: { eventId: offsite.id } });
  const depositData = withTotal([{ description: "Team offsite — deposit (50%)", unitPrice: 48000 }]);
  await prisma.invoice.create({
    data: {
      eventId: offsite.id,
      quoteId: offsiteQuote.id,
      number: "2026-0143",
      variableSymbol: variableSymbol("2026-0143"),
      status: "PAID",
      dueDate: d("2026-08-05"),
      issuedAt: d("2026-07-29"),
      paidAt: d("2026-08-01"),
      amountPaid: depositData.total,
      ...depositData,
      payments: { create: [{ amount: depositData.total, date: d("2026-08-01"), note: "Deposit received", recordedById: accountant.id }] },
      history: {
        create: [
          { type: "CREATED", message: "Created from quote 2026-Q35", createdAt: d("2026-07-29"), userId: accountant.id },
          { type: "ISSUED", message: "Issued and sent — E. Kučerová", createdAt: d("2026-07-29"), userId: accountant.id },
          { type: "MARKED_PAID", message: "Deposit paid in full — E. Kučerová", createdAt: d("2026-08-01"), userId: accountant.id },
        ],
      },
    },
  });
  const balanceData = withTotal([{ description: "Team offsite — balance (50%)", unitPrice: 48000 }]);
  await prisma.invoice.create({
    data: {
      eventId: offsite.id,
      quoteId: offsiteQuote.id,
      number: "2026-0144",
      variableSymbol: variableSymbol("2026-0144"),
      status: "ISSUED",
      dueDate: d("2026-08-22"),
      issuedAt: d("2026-08-08"),
      ...balanceData,
      history: {
        create: [
          { type: "CREATED", message: "Created from quote 2026-Q35", createdAt: d("2026-08-08"), userId: accountant.id },
          { type: "ISSUED", message: "Issued and sent — E. Kučerová", createdAt: d("2026-08-08"), userId: accountant.id },
        ],
      },
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

  // --- Roadshow — closed, initial quote rejected, smaller follow-up job overdue ---
  await prisma.event.create({
    data: {
      title: "Roadshow",
      brief: "Aeris regional roadshow — three-city pop-up activation.",
      clientName: "Radka Sýkorová",
      clientPhone: "+420 604 552 019",
      clientEmail: "sykorova@aeris.cz",
      companyName: "Aeris",
      companyAddress: "Karlovo náměstí 10, Praha 2",
      companyIco: "08812234",
      companyDic: "CZ08812234",
      status: "CLOSED",
      startDate: d("2026-06-18T09:00:00"),
      endDate: d("2026-06-20T18:00:00"),
      quotedValue: 96000,
      ownerId: admin.id,
      quotes: {
        create: [
          {
            number: "2026-Q27",
            status: "DECLINED",
            validUntil: d("2026-07-02"),
            issuedAt: d("2026-06-18"),
            ...withTotal([{ description: "Roadshow — full three-city package", unitPrice: 96000 }]),
          },
        ],
      },
    },
  });

  const roadshow = await prisma.event.findFirstOrThrow({ where: { title: "Roadshow" } });
  const roadshowInvoiceData = withTotal([{ description: "Roadshow — single-city pop-up (reduced scope)", unitPrice: 23554 }]);
  await prisma.invoice.create({
    data: {
      eventId: roadshow.id,
      number: "2026-0139",
      variableSymbol: variableSymbol("2026-0139"),
      status: "ISSUED",
      dueDate: d("2026-07-16"),
      issuedAt: d("2026-07-02"),
      ...roadshowInvoiceData,
      history: {
        create: [
          { type: "CREATED", message: "Reduced-scope invoice created", createdAt: d("2026-07-02"), userId: admin.id },
          { type: "ISSUED", message: "Issued and sent — Admin User", createdAt: d("2026-07-02"), userId: admin.id },
        ],
      },
    },
  });

  // --- Dealer meeting — fresh inquiry, quote still in draft ---
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
      quotes: {
        create: [
          {
            number: "2026-Q33",
            status: "DRAFT",
            validUntil: d("2026-09-15"),
            issuedAt: d("2026-08-11"),
            ...withTotal([{ description: "Dealer meeting — draft scope", unitPrice: 74500 }]),
          },
        ],
      },
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
    },
  });

  const springKickoff = await prisma.event.findFirstOrThrow({ where: { title: "Spring Kickoff" } });
  const springData = withTotal([{ description: "Spring Kickoff — full package", unitPrice: 180000 }]);
  await prisma.invoice.create({
    data: {
      eventId: springKickoff.id,
      number: "2026-0056",
      variableSymbol: variableSymbol("2026-0056"),
      status: "PAID",
      dueDate: d("2026-03-28"),
      issuedAt: d("2026-03-15"),
      paidAt: d("2026-03-26"),
      amountPaid: springData.total,
      ...springData,
      payments: { create: [{ amount: springData.total, date: d("2026-03-26"), note: "Bank transfer", recordedById: accountant.id }] },
      history: {
        create: [
          { type: "CREATED", message: "Invoice created", createdAt: d("2026-03-15"), userId: accountant.id },
          { type: "ISSUED", message: "Issued and sent — E. Kučerová", createdAt: d("2026-03-15"), userId: accountant.id },
          { type: "MARKED_PAID", message: "Paid in full — E. Kučerová", createdAt: d("2026-03-26"), userId: accountant.id },
        ],
      },
    },
  });

  // --- company overhead expenses, not tied to any event ---
  await prisma.expense.createMany({
    data: [
      { paidById: producer.id, amount: 1490, date: d("2026-08-05"), category: "GENERIC", note: "office supplies" },
      { paidById: admin.id, amount: 8900, date: d("2026-08-11"), category: "GEAR", note: "replacement laptop charger" },
    ],
  });

  console.log("Seeded 7 events, 4 users, company settings. Dev login password for all seed accounts:", DEV_PASSWORD);
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
