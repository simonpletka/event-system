/**
 * Worldwide address suggestions via Photon (komoot's free public instance,
 * built on OpenStreetMap data) — no API key, no billing account, unlike
 * Google Places. Chosen specifically because the user asked for worldwide
 * coverage, which rules out the Czech-only RÚIAN registry that would
 * otherwise have matched the ARES-integration precedent more closely.
 */
const PHOTON_BASE = "https://photon.komoot.io/api/";

export type AddressSuggestion = { label: string; lat: number; lon: number };

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

export async function searchAddresses(query: string): Promise<AddressSuggestion[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  const url = `${PHOTON_BASE}?q=${encodeURIComponent(q)}&limit=5`;
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
    }))
    .filter((s) => s.label);
}
