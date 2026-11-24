// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";
import { commitGearReservation, GearPlanRejected, replaceGearBatch } from "../gear-commit";
import { reservationScopeWhere } from "../gear-scope";
import { resolveGearScan } from "../gear-scan";
import { newGearCodes } from "../gear-units";

// A real SQLite file built from the migrations, so the transaction runs the
// way it does in the app.
const dir = mkdtempSync(path.join(tmpdir(), "gear-commit-"));
const file = path.join(dir, "test.db");
let prisma: PrismaClient;
let projectId = "";
let typeId = "";

beforeAll(async () => {
  const migrations = path.join(process.cwd(), "prisma", "migrations");
  // better-sqlite3 ships no typings for exec here.
  const db = new Database(file) as unknown as { exec(sql: string): void; close(): void };
  for (const name of readdirSync(migrations).filter((n) => /^\d/.test(n)).sort()) {
    db.exec(readFileSync(path.join(migrations, name, "migration.sql"), "utf8"));
  }
  db.close();
  prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${file}` }) });

  const owner = await prisma.user.create({ data: { name: "T", email: "t@example.com", passwordHash: "x", role: "ADMIN" } });
  const project = await prisma.project.create({
    data: { number: "26-901", title: "Test", companyName: "Test", startDate: new Date(), endDate: new Date(), ownerId: owner.id },
  });
  projectId = project.id;
  const category = await prisma.gearCategory.create({ data: { name: "Cameras" } });
  const type = await prisma.gearType.create({
    data: { name: "Sony FX30", categoryId: category.id, purchasePrice: 52900, units: { create: [{ number: 1, code: "AAAA1111", tagUid: "E2:00:01" }, { number: 2, code: "BBBB2222" }] } },
  });
  typeId = type.id;
});

afterAll(async () => {
  await prisma?.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

const base = { startDate: "2026-11-26", endDate: "2026-11-27", groupId: null, userId: null };

describe("commitGearReservation", () => {
  it("never books one unit twice when two reservations race", async () => {
    const attempt = () =>
      prisma.$transaction((tx) => commitGearReservation(tx, { ...base, projectId, lines: [{ typeId, quantity: 2 }] })).catch((e: Error) => e);
    const results = await Promise.all([attempt(), attempt()]);
    const succeeded = results.filter((r) => !(r instanceof Error) && r.ok);
    expect(succeeded).toHaveLength(1);

    const rows = await prisma.gearReservation.findMany();
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((r) => r.unitId)).size).toBe(2);
  });

  it("refuses a plan that came up short of what was agreed", async () => {
    const result = await prisma.$transaction((tx) =>
      commitGearReservation(tx, { ...base, startDate: "2026-11-27", endDate: "2026-11-28", projectId, lines: [{ typeId, quantity: 1 }] })
    );
    expect(result.ok).toBe(false);
    expect(await prisma.gearReservation.count()).toBe(2);
  });

  it("books gear for no project, with a note", async () => {
    const result = await prisma.$transaction((tx) =>
      commitGearReservation(tx, { ...base, startDate: "2026-12-01", endDate: "2026-12-01", projectId: null, note: "Showreel", lines: [{ typeId, quantity: 1 }] })
    );
    expect(result.ok).toBe(true);
    const row = await prisma.gearReservation.findFirstOrThrow({ where: { startDate: "2026-12-01" } });
    expect([row.projectId, row.note]).toEqual([null, "Showreel"]);
  });

  it("books the free units from the next day on", async () => {
    const result = await prisma.$transaction((tx) =>
      commitGearReservation(tx, { ...base, startDate: "2026-11-28", endDate: "2026-11-28", projectId, lines: [{ typeId, quantity: 1 }] })
    );
    expect(result.ok && result.plan[0].units.map((u) => u.number)).toEqual([1]);
  });
});

describe("replaceGearBatch (editing a reservation)", () => {
  it("moves the dates and keeps the units it held", async () => {
    const made = await prisma.$transaction((tx) =>
      commitGearReservation(tx, { ...base, startDate: "2026-12-10", endDate: "2026-12-10", projectId, lines: [{ typeId, quantity: 1 }] })
    );
    if (!made.ok) throw new Error("setup");
    const before = made.plan[0].units[0].number;
    const edited = await prisma.$transaction((tx) =>
      replaceGearBatch(tx, made.batchId, { lines: [{ typeId, quantity: 1 }], startDate: "2026-12-11", endDate: "2026-12-12", projectId: null, note: "moved", userId: null })
    );
    expect(edited.ok && edited.plan[0].units[0].number).toBe(before);
    const rows = await prisma.gearReservation.findMany({ where: { batchId: made.batchId } });
    expect(rows.map((r) => [r.startDate, r.endDate, r.projectId, r.note])).toEqual([["2026-12-11", "2026-12-12", null, "moved"]]);
  });

  it("rolls everything back when the edit can't be covered", async () => {
    const made = await prisma.$transaction((tx) =>
      commitGearReservation(tx, { ...base, startDate: "2026-12-20", endDate: "2026-12-20", projectId, lines: [{ typeId, quantity: 1 }] })
    );
    if (!made.ok) throw new Error("setup");
    // Only two units exist, so asking for three is short.
    const attempt = prisma.$transaction((tx) =>
      replaceGearBatch(tx, made.batchId, { lines: [{ typeId, quantity: 3 }], startDate: "2026-12-20", endDate: "2026-12-20", projectId, userId: null })
    );
    await expect(attempt).rejects.toBeInstanceOf(GearPlanRejected);
    expect(await prisma.gearReservation.count({ where: { batchId: made.batchId } })).toBe(1);
  });
});

describe("reservationScopeWhere", () => {
  // An all-projects user (Admin) gets projectWhere = {}. A bare `project: {}`
  // on the optional relation matched nothing and hid every project booking.
  it("lists project bookings and project-less ones for an all-projects user", async () => {
    const total = await prisma.gearReservation.count();
    const withProject = await prisma.gearReservation.count({ where: { projectId: { not: null } } });
    expect(withProject).toBeGreaterThan(0);
    expect(await prisma.gearReservation.count({ where: reservationScopeWhere({}, "all", "2026-01-01") })).toBe(total);
    expect(await prisma.gearReservation.count({ where: reservationScopeWhere({}, "project", "2026-01-01") })).toBe(withProject);
    expect(await prisma.gearReservation.count({ where: reservationScopeWhere({}, "none", "2026-01-01") })).toBe(total - withProject);
  });

  it("hides bookings on projects the user can't see", async () => {
    const hidden = { id: "no-such-project" };
    expect(await prisma.gearReservation.count({ where: reservationScopeWhere(hidden, "project", "2026-01-01") })).toBe(0);
  });
});

describe("resolveGearScan", () => {
  it("finds a unit by full URL, bare code (typed loosely) or tag id, and nothing for garbage", async () => {
    expect((await resolveGearScan(prisma, "https://app.example.com/g/AAAA1111"))?.number).toBe(1);
    expect((await resolveGearScan(prisma, "bbbb-2222"))?.number).toBe(2);
    expect((await resolveGearScan(prisma, "E2:00:01"))?.number).toBe(1);
    expect(await resolveGearScan(prisma, "ZZZZ9999")).toBeNull();
    expect(await resolveGearScan(prisma, "not a code at all")).toBeNull();
  });

  it("hands out codes no unit has", async () => {
    const codes = await newGearCodes(prisma, 50);
    expect(new Set(codes).size).toBe(50);
    expect(codes).not.toContain("AAAA1111");
  });
});
