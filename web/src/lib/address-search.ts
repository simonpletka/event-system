/**
 * Worldwide address suggestions via Photon (komoot's free public instance,
 * built on OpenStreetMap data) — no API key, no billing account, unlike
 * Google Places. Chosen specifically because the user asked for worldwide
 * coverage, which rules out the Czech-only RÚIAN registry that would
 * otherwise have matched the ARES-integration precedent more closely.
 */
const PHOTON_BASE = "https://photon.komoot.io/api/";

export type AddressSuggestion = {
  label: string;
  lat: number;
  lon: number;
  // Structured components, for callers (like the Client form's
  // StructuredAddressInput) that store address parts separately instead of
  // one free-text line. Photon already returns these — formatLabel() below
  // just used to throw them away.
  street: string;
  city: string;
  postCode: string;
  state: string;
};

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    housenumber?: string;
    street?: string;
    city?: string;
    postcode?: string;
    state?: string;
    country?: string;
  };
};

function formatLabel(p: PhotonFeature["properties"]): string {
  const streetPart = [p.street, p.housenumber].filter(Boolean).join(" ");
  const line1 = streetPart || p.name || "";
  const cityPart = [p.postcode, p.city].filter(Boolean).join(" ");
  const parts = [line1, cityPart, p.country].filter((s) => s && s !== line1);
  return [line1, ...parts.slice(1)].filter(Boolean).join(", ") || p.name || "";
}

export async function searchAddresses(
  query: string,
  near?: { lat: number; lon: number }
): Promise<AddressSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  const bias = near ? `&lat=${near.lat}&lon=${near.lon}` : "";
  const url = `${PHOTON_BASE}?q=${encodeURIComponent(q)}&limit=5${bias}`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: "application/json" } });
  } catch {
    return [];
  }
  if (!res.ok) return [];

  const data = await res.json();
  const features: PhotonFeature[] = data?.features ?? [];
  return features
    .map((f) => ({
      label: formatLabel(f.properties),
      lat: f.geometry.coordinates[1],
      lon: f.geometry.coordinates[0],
      street: [f.properties.street, f.properties.housenumber].filter(Boolean).join(" "),
      city: f.properties.city ?? "",
      postCode: f.properties.postcode ?? "",
      state: f.properties.state ?? "",
    }))
    .filter((s) => s.label);
}

const LOOKUP_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1500;

/**
 * Best match per address, for looking up several at once. Photon's public
 * instance answers 503 to quick bursts and stays closed for a while after, so
 * these go strictly one at a time, repeats reuse the first answer, and an
 * empty result is retried because a refusal looks the same as no match.
 */
export async function locateAddresses(addresses: string[], near?: { lat: number; lon: number }) {
  const found = new Map<string, AddressSuggestion | null>();
  for (const address of addresses) {
    if (found.has(address)) continue;
    let match: AddressSuggestion | null = null;
    for (let attempt = 0; attempt < LOOKUP_ATTEMPTS && !match; attempt++) {
      if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, attempt * RETRY_DELAY_MS));
      match = (await searchAddresses(address, near))[0] ?? null;
    }
    found.set(address, match);
  }
  return found;
}
