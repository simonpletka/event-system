/**
 * ARES — the Czech business registry (ares.gov.cz), a free public government
 * API, no key/auth required. Brief §5.2/§5e: company details auto-fill by IČO.
 */

const ARES_BASE = "https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty";

export type AresCompany = {
  ico: string;
  name: string;
  /** Flat one-line address (ARES's own textovaAdresa) — what ProjectForm/CompanySettingsForm's single free-text address field wants. */
  address: string;
  /** Street + house/orientation number only, e.g. "Vojtěšská 211/6" — for ClientForm's structured address fields. */
  street: string;
  city: string;
  /** "XXX XX" Czech postcode format. */
  postCode: string;
  /** Always "Česká republika" for an ARES result — every ARES-registered company is Czech. */
  state: string;
  dic: string;
};

export type AresLookupResult = { company: AresCompany } | { error: string };

function formatPostCode(psc: unknown): string {
  const digits = String(psc ?? "").replace(/\D/g, "");
  if (digits.length !== 5) return digits;
  return `${digits.slice(0, 3)} ${digits.slice(3)}`;
}

/**
 * ARES's own `adresaDorucovaci` ("delivery address") is already split into
 * exactly the three lines we want — street+number, an optional part-of-town
 * qualifier (Karlín, Nové Město, "Mladá Boleslav II"…) we don't have a field
 * for and drop, and "PSC City". Confirmed against three real companies
 * (Prague with a city district, Prague with a different district, and a
 * non-Prague town) before writing this — the shape holds across all three.
 * Falls back to reconstructing from the raw `sidlo` fields on the rare
 * record that lacks `adresaDorucovaci`.
 */
function splitAddress(data: Record<string, unknown>): { street: string; city: string; postCode: string } {
  const sidlo = (data.sidlo as Record<string, unknown>) ?? {};
  const doruc = (data.adresaDorucovaci as Record<string, unknown>) ?? {};

  const line1 = typeof doruc.radekAdresy1 === "string" ? doruc.radekAdresy1 : "";
  const line3 = typeof doruc.radekAdresy3 === "string" ? doruc.radekAdresy3 : "";

  let city = "";
  let postCode = "";
  const match = line3.match(/^(\d{3}\s?\d{2})\s+(.+)$/);
  if (match) {
    postCode = formatPostCode(match[1]);
    city = match[2];
  } else if (line3) {
    city = line3;
  }

  let street = line1;
  if (!street) {
    const houseNumber = sidlo.cisloDomovni != null ? String(sidlo.cisloDomovni) + (sidlo.cisloOrientacni != null ? `/${sidlo.cisloOrientacni}` : "") : "";
    street = [sidlo.nazevUlice, houseNumber].filter(Boolean).join(" ");
  }
  if (!city) {
    city = (sidlo.nazevMestskehoObvodu as string) || (sidlo.nazevObce as string) || "";
  }
  if (!postCode) {
    postCode = formatPostCode(sidlo.psc);
  }

  return { street, city, postCode };
}

export async function lookupCompanyByIco(ico: string): Promise<AresLookupResult> {
  const digits = ico.replace(/\s+/g, "");
  if (!/^\d{8}$/.test(digits)) {
    return { error: "IČO must be 8 digits." };
  }

  let res: Response;
  try {
    res = await fetch(`${ARES_BASE}/${digits}`, { headers: { Accept: "application/json" } });
  } catch {
    return { error: "Couldn't reach the ARES registry — try again in a moment." };
  }

  if (res.status === 404) {
    return { error: "No company found for that IČO." };
  }
  if (!res.ok) {
    return { error: `ARES lookup failed (${res.status}).` };
  }

  const data = await res.json();
  const { street, city, postCode } = splitAddress(data);

  return {
    company: {
      ico: data.ico ?? digits,
      name: data.obchodniJmeno ?? "",
      address: data.sidlo?.textovaAdresa ?? "",
      street,
      city,
      postCode,
      state: "Česká republika",
      dic: data.dic ?? "",
    },
  };
}
