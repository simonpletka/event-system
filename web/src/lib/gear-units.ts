/**
 * Creating units: every new unit needs a fresh code. Takes the database
 * client as an argument (no "@/lib/prisma" import) so demo data, actions and
 * tests share it.
 */
import type { PrismaClient } from "@/generated/prisma/client";
import { generateGearCode } from "./gear-code";

type Db = Pick<PrismaClient, "gearUnit">;

/** `count` codes no unit has yet, all different. */
export async function newGearCodes(db: Db, count: number) {
  const codes = new Set<string>();
  for (let tries = 0; codes.size < count; tries++) {
    if (tries > count * 20 + 20) throw new Error("Couldn't find free gear codes.");
    const code = generateGearCode();
    if (codes.has(code)) continue;
    if (await db.gearUnit.findUnique({ where: { code }, select: { id: true } })) continue;
    codes.add(code);
  }
  return [...codes];
}

/** Nested-create rows for units #1…#count with fresh codes. */
export async function unitRows(db: Db, count: number, firstNumber = 1) {
  const codes = await newGearCodes(db, count);
  return codes.map((code, i) => ({ number: firstNumber + i, code }));
}
