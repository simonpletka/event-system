// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";
import { commitGearReservation } from "../gear-commit";

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
    data: { name: "Sony FX30", categoryId: category.id, purchasePrice: 52900, units: { create: [{ number: 1 }, { number: 2 }] } },
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
