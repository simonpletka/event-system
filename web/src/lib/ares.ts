/**
 * ARES — the Czech business registry (ares.gov.cz), a free public government
 * API, no key/auth required. Brief §5.2/§5e: company details auto-fill by IČO.
 */

const ARES_BASE = "https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty";

export type AresCompany = {
  ico: string;
  name: string;
  address: string;
  dic: string;
};

export type AresLookupResult = { company: AresCompany } | { error: string };

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
  return {
    company: {
      ico: data.ico ?? digits,
      name: data.obchodniJmeno ?? "",
      address: data.sidlo?.textovaAdresa ?? "",
      dic: data.dic ?? "",
    },
  };
}
