/**
 * The one way into a unit from the outside: a scanned QR or NFC URL, a code
 * typed off a label, or a UHF RFID tag id. Every entry point (the /g/<code>
 * page, the Gear search box, a camera or reader later) goes through
 * resolveGearScan, so they can't disagree about what a scan means.
 * Takes the database client as an argument (no "@/lib/prisma" import) so the
 * tests can run it against a real SQLite file.
 */
import type { PrismaClient } from "@/generated/prisma/client";
import { normalizeGearCode } from "./gear-code";

export type GearScanInput = { code: string | null; tagUid: string | null };

/** What a scan or typed value could be. Null when it can't be any unit's. */
export function parseGearScanInput(raw: string): GearScanInput | null {
  const input = raw.trim();
  if (!input || input.length > 300) return null;

  // A full or relative URL: only the /g/<code> path counts.
  if (/^https?:\/\//i.test(input) || input.startsWith("/")) {
    let pathname = input;
    try {
      pathname = new URL(input, "http://x").pathname;
    } catch {
      return null;
    }
    const m = /\/g\/([^/?#]+)\/?$/.exec(pathname);
    const code = m ? normalizeGearCode(decodeURIComponent(m[1])) : null;
    return code ? { code, tagUid: null } : null;
  }

  const code = normalizeGearCode(input);
  // A bare value may be a code or a tag id; tag ids are stored as read.
  const tagUid = /^[A-Za-z0-9:_-]{4,64}$/.test(input) ? input : null;
  if (!code && !tagUid) return null;
  return { code, tagUid };
}

type Db = Pick<PrismaClient, "gearUnit">;

/** The unit a scan or typed value points to, or null. */
export async function resolveGearScan(db: Db, raw: string) {
  const parsed = parseGearScanInput(raw);
  if (!parsed) return null;
  const include = { type: { select: { id: true, name: true } } } as const;
  if (parsed.code) {
    const unit = await db.gearUnit.findUnique({ where: { code: parsed.code }, include });
    if (unit) return unit;
  }
  if (parsed.tagUid) return db.gearUnit.findUnique({ where: { tagUid: parsed.tagUid }, include });
  return null;
}
