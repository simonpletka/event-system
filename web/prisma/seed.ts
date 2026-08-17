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

type ItemInput = { description: string; quantity?: number; unitPrice: number; vatRate?: number; category?: string };

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
        category: i.category ?? "",
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
  await prisma.eventContact.deleteMany();
  await prisma.event.deleteMany();
  await prisma.clientContact.deleteMany();
  await prisma.client.deleteMany();
  await prisma.user.deleteMany();
  await prisma.companySettings.deleteMany();
  await prisma.itemCategory.deleteMany();

  await prisma.itemCategory.createMany({
    data: ["Video", "Audio", "Rigging", "People", "Other"].map((name, sortOrder) => ({ name, sortOrder })),
  });

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
  const HOUR = 60 * 60 * 1000;

  const admin = await prisma.user.create({
    data: {
      name: "Admin User",
      email: "admin@eventsystem.cz",
      phone: "+420 601 100 200",
      passwordHash,
      role: "ADMIN",
      lastSeenAt: new Date(),
    },
  });

  const accountant = await prisma.user.create({
    data: {
      name: "Eva Kučerová",
      email: "eva.kucerova@eventsystem.cz",
      phone: "+420 602 330 441",
      passwordHash,
      role: "ACCOUNTANT",
      lastSeenAt: new Date(Date.now() - 2 * HOUR),
    },
  });

  const producer = await prisma.user.create({
    data: {
      name: "J. Novák",
      email: "jan.novak@eventsystem.cz",
      phone: "+420 603 550 118",
      passwordHash,
      role: "PRODUCER",
      isCardHolder: true,
      lastSeenAt: new Date(),
    },
  });

  const member = await prisma.user.create({
    data: {
      name: "M. Dvořák",
      email: "m.dvorak@eventsystem.cz",
      passwordHash,
      role: "MEMBER",
      lastSeenAt: new Date(Date.now() - 24 * HOUR),
    },
  });

  // --- Clients — one per demo company, so the Clients section has real
  // data instead of every demo event sitting unlinked. Contacts here match
  // the EventContact rows created below verbatim (same person, same
  // details) since in real usage that's exactly what syncClientContacts()
  // would produce from saving each event through the UI.
  const kobra = await prisma.client.create({
    data: {
      name: "Kobra a.s.",
      address: "Vinohradská 12, Praha 2",
      ico: "27182904",
      dic: "CZ27182904",
      invoicingEmail: "valkova@kobra.cz",
      contacts: { create: [{ name: "Petra Válková", phone: "+420 771 220 118", email: "valkova@kobra.cz" }] },
    },
  });
  const nordika = await prisma.client.create({
    data: {
      name: "Nordika",
      address: "Lidická 20, Brno",
      ico: "05512244",
      dic: "CZ05512244",
      invoicingEmail: "benes@nordika.cz",
      contacts: { create: [{ name: "Tomáš Beneš", phone: "+420 602 118 400", email: "benes@nordika.cz" }] },
    },
  });
  const vela = await prisma.client.create({
    data: {
      name: "Vela s.r.o.",
      address: "Náměstí Míru 5, Praha 2",
      ico: "09984411",
      dic: "CZ09984411",
      invoicingEmail: "maresova@vela.cz",
      contacts: { create: [{ name: "Lucie Marešová", phone: "+420 733 900 210", email: "maresova@vela.cz" }] },
    },
  });
  const aeris = await prisma.client.create({
    data: {
      name: "Aeris",
      address: "Karlovo náměstí 10, Praha 2",
      ico: "08812234",
      dic: "CZ08812234",
      invoicingEmail: "sykorova@aeris.cz",
      contacts: { create: [{ name: "Radka Sýkorová", phone: "+420 604 552 019", email: "sykorova@aeris.cz" }] },
    },
  });

  // --- Autumn Conference — confirmed, upcoming, fully fleshed out ---
  await prisma.event.create({
    data: {
      number: "26-001",
      title: "Autumn Conference 2026",
      brief:
        "Two-day corporate conference for Kobra a.s. — keynote, breakout tracks, evening reception on the boat.",
      clientId: kobra.id,
      contacts: { create: [{ name: "Petra Válková", phone: "+420 771 220 118", email: "valkova@kobra.cz" }] },
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
          { userId: producer.id, minutes: 1200, date: d("2026-08-10"), description: "Run of show planning", phase: "PLANNING" },
          { userId: producer.id, minutes: 1450, date: d("2026-08-13"), description: "Supplier calls — AV & catering", phase: "SUPPLIERS" },
          { userId: member.id, minutes: 765, date: d("2026-08-15"), description: "Vendor coordination", phase: "SUPPLIERS" },
          { userId: member.id, minutes: 920, date: d("2026-08-16"), description: "Venue walkthrough", phase: "ON_SITE" },
        ],
      },
      quotes: {
        create: [
          {
            number: "26-001",
            status: "ACCEPTED",
            validUntil: d("2026-08-15"),
            issuedAt: d("2026-07-28"),
            hideItemPrices: false,
            createdById: producer.id,
            ...withTotal([
              { description: "Production management — Autumn Conference", unitPrice: 250000, category: "People" },
              { description: "Stage & light rental", unitPrice: 60000, category: "Rigging" },
              { description: "Crew — build day", quantity: 6, unitPrice: 5000, category: "People" },
            ]),
          },
        ],
      },
    },
  });

  const autumn = await prisma.event.findFirstOrThrow({ where: { title: "Autumn Conference 2026" } });
  const autumnQuote = await prisma.quote.findFirstOrThrow({ where: { eventId: autumn.id } });
  const autumnInvoiceData = withTotal([
    { description: "Production management — Autumn Conference", unitPrice: 250000, category: "People" },
    { description: "Stage & light rental", unitPrice: 60000, category: "Rigging" },
    { description: "Crew — build day", quantity: 6, unitPrice: 5000, category: "People" },
  ]);
  await prisma.invoice.create({
    data: {
      eventId: autumn.id,
      quoteId: autumnQuote.id,
      number: "26-001",
      variableSymbol: variableSymbol("26-001"),
      status: "PARTLY_PAID",
      hideItemPrices: false,
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
          { type: "CREATED", message: "Created from quote 26-001", createdAt: d("2026-08-04"), userId: producer.id },
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
      number: "26-002",
      title: "Product launch",
      brief: "Nordika's autumn product launch — press + partner event.",
      clientId: nordika.id,
      contacts: { create: [{ name: "Tomáš Beneš", phone: "+420 602 118 400", email: "benes@nordika.cz" }] },
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
            number: "26-002",
            status: "SENT",
            validUntil: d("2026-08-31"),
            issuedAt: d("2026-08-14"),
            createdById: producer.id,
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
      number: "26-003",
      title: "Team offsite",
      brief: "Vela's internal team offsite — workshops + outdoor activities.",
      clientId: vela.id,
      contacts: { create: [{ name: "Lucie Marešová", phone: "+420 733 900 210", email: "maresova@vela.cz" }] },
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
            number: "26-003",
            status: "ACCEPTED",
            validUntil: d("2026-08-10"),
            issuedAt: d("2026-07-25"),
            createdById: accountant.id,
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
      number: "26-003",
      variableSymbol: variableSymbol("26-003"),
      status: "PAID",
      dueDate: d("2026-08-05"),
      issuedAt: d("2026-07-29"),
      paidAt: d("2026-08-01"),
      amountPaid: depositData.total,
      ...depositData,
      payments: { create: [{ amount: depositData.total, date: d("2026-08-01"), note: "Deposit received", recordedById: accountant.id }] },
      history: {
        create: [
          { type: "CREATED", message: "Created from quote 26-003", createdAt: d("2026-07-29"), userId: accountant.id },
          { type: "ISSUED", message: "Issued and sent — E. Kučerová", createdAt: d("2026-07-29"), userId: accountant.id },
          { type: "MARKED_PAID", message: "Deposit paid in full — E. Kučerová", createdAt: d("2026-08-01"), userId: accountant.id },
        ],
      },
    },
  });
  // Demoing the discount feature: 10% off, applied to the pre-VAT base with
  // VAT recomputed on the discounted amount — base 48000, discount 4800,
  // discounted base 43200, VAT 21% of that is 9072, total 52272.
  const balanceData = withTotal([{ description: "Team offsite — balance (50%)", unitPrice: 48000 }]);
  await prisma.invoice.create({
    data: {
      eventId: offsite.id,
      quoteId: offsiteQuote.id,
      number: "26-003_v2",
      variableSymbol: variableSymbol("26-003_v2"),
      status: "ISSUED",
      dueDate: d("2026-08-22"),
      issuedAt: d("2026-08-08"),
      ...balanceData,
      total: 52272,
      discountType: "PERCENT",
      discountValue: 10,
      history: {
        create: [
          { type: "CREATED", message: "Created from quote 26-003", createdAt: d("2026-08-08"), userId: accountant.id },
          { type: "ISSUED", message: "Issued and sent — E. Kučerová", createdAt: d("2026-08-08"), userId: accountant.id },
        ],
      },
    },
  });

  // --- Summer Gala — ended, waiting to be invoiced (needs-attention tile) ---
  await prisma.event.create({
    data: {
      number: "26-004",
      title: "Summer Gala",
      brief: "Aeris annual summer gala — 400 guests, dinner + live music.",
      clientId: aeris.id,
      contacts: { create: [{ name: "Radka Sýkorová", phone: "+420 604 552 019", email: "sykorova@aeris.cz" }] },
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
      number: "26-005",
      title: "Roadshow",
      brief: "Aeris regional roadshow — three-city pop-up activation.",
      clientId: aeris.id,
      contacts: { create: [{ name: "Radka Sýkorová", phone: "+420 604 552 019", email: "sykorova@aeris.cz" }] },
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
            number: "26-005",
            status: "DECLINED",
            validUntil: d("2026-07-02"),
            issuedAt: d("2026-06-18"),
            createdById: admin.id,
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
      number: "26-005",
      variableSymbol: variableSymbol("26-005"),
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
      number: "26-006",
      title: "Dealer meeting",
      brief: "Regional dealer meeting for Kobra a.s. — scope not yet confirmed.",
      clientId: kobra.id,
      contacts: { create: [{ name: "Petra Válková", phone: "+420 771 220 118", email: "valkova@kobra.cz" }] },
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
            number: "26-006",
            status: "DRAFT",
            validUntil: d("2026-09-15"),
            issuedAt: d("2026-08-11"),
            createdById: producer.id,
            ...withTotal([{ description: "Dealer meeting — draft scope", unitPrice: 74500 }]),
          },
        ],
      },
    },
  });

  // --- Spring Kickoff — archived, closed and paid ---
  await prisma.event.create({
    data: {
      number: "26-007",
      title: "Spring Kickoff",
      brief: "Nordika's spring kickoff event — completed and archived.",
      clientId: nordika.id,
      contacts: { create: [{ name: "Tomáš Beneš", phone: "+420 602 118 400", email: "benes@nordika.cz" }] },
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
      number: "26-007",
      variableSymbol: variableSymbol("26-007"),
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

  // --- more time-tracking history so Compare Events has real multi-event, multi-person data ---
  const gala = await prisma.event.findFirstOrThrow({ where: { title: "Summer Gala" } });
  await prisma.timeEntry.createMany({
    data: [
      { eventId: gala.id, userId: admin.id, minutes: 1830, date: d("2026-07-25"), description: "Vendor sourcing", phase: "SUPPLIERS" },
      { eventId: gala.id, userId: admin.id, minutes: 1200, date: d("2026-08-01"), description: "Run of show", phase: "PLANNING" },
      { eventId: gala.id, userId: accountant.id, minutes: 1740, date: d("2026-08-09"), description: "On-site guest list & payments", phase: "ON_SITE" },
      { eventId: gala.id, userId: producer.id, minutes: 340, date: d("2026-08-10"), description: "Wrap-up notes", phase: "WRAP_UP" },
    ],
  });
  await prisma.timeEntry.createMany({
    data: [
      { eventId: springKickoff.id, userId: admin.id, minutes: 1450, date: d("2026-02-20"), description: "Planning workshop", phase: "PLANNING" },
      { eventId: springKickoff.id, userId: accountant.id, minutes: 1330, date: d("2026-03-01"), description: "Supplier contracts", phase: "SUPPLIERS" },
      { eventId: springKickoff.id, userId: admin.id, minutes: 970, date: d("2026-03-14"), description: "On-site coordination", phase: "ON_SITE" },
      { eventId: springKickoff.id, userId: accountant.id, minutes: 155, date: d("2026-03-16"), description: "Final invoice reconciliation", phase: "WRAP_UP" },
    ],
  });

  // --- one running timer, so the sidebar widget has something real to show ---
  await prisma.timeEntry.create({
    data: {
      eventId: autumn.id,
      userId: producer.id,
      description: "Build plan and crew schedule",
      phase: "ON_SITE",
      running: true,
      startedAt: new Date(Date.now() - 72 * 60 * 1000),
      date: new Date(),
    },
  });

  console.log("Seeded 7 events, 4 clients, 4 users, company settings. Dev login password for all seed accounts:", DEV_PASSWORD);
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
