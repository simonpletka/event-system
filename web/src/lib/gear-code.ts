/**
 * Unit codes: the permanent public id printed on a unit's label and carried
 * by its QR code or NFC tag as the URL /g/<code>. 8 characters of Crockford
 * base32 (no I, L, O or U, so nothing reads as 1, 0 or a rude word), random,
 * so codes say nothing about stock size or order. Client-safe, no imports.
 */
export const GEAR_CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const GEAR_CODE_LENGTH = 8;

export function generateGearCode(): string {
  const bytes = new Uint8Array(GEAR_CODE_LENGTH);
  globalThis.crypto.getRandomValues(bytes);
  // 256 is a multiple of 32, so taking the low 5 bits is unbiased.
  return Array.from(bytes, (b) => GEAR_CODE_ALPHABET[b & 31]).join("");
}

/**
 * A typed or scanned code in canonical form, or null. Reads it the way a
 * person types it off a label: any case, spaces or dashes, and O/I/L for
 * 0/1/1 as Crockford allows.
 */
export function normalizeGearCode(input: string): string | null {
  const s = input
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  if (s.length !== GEAR_CODE_LENGTH) return null;
  for (const ch of s) if (!GEAR_CODE_ALPHABET.includes(ch)) return null;
  return s;
}

/** "ABCD-EFGH": easier to read off a label. */
export function formatGearCode(code: string) {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

/** A fresh code no unit uses yet. `taken` checks the database. */
export async function uniqueGearCode(taken: (code: string) => Promise<boolean>) {
  for (let i = 0; i < 20; i++) {
    const code = generateGearCode();
    if (!(await taken(code))) return code;
  }
  throw new Error("Couldn't find a free gear code.");
}
