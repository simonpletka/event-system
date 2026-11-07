/**
 * Drive time and distance for a trip leg. Google's Routes API is used when
 * GOOGLE_MAPS_API_KEY is set — it's the only source here with predicted
 * traffic. Without a key (or if the call fails) this falls back to OSRM's
 * free public server on OpenStreetMap data, which knows distance and road
 * speeds but not traffic, so callers must surface `source` to the user.
 *
 * Waze has no public routing API, only deep links, so it can't be a source
 * here — see wazeUrl() below.
 */
export type LatLng = { lat: number; lng: number };
export type RouteSource = "google" | "osm";
export type RouteEstimate = { minutes: number; km: number; source: RouteSource; polyline: string | null };

const TIMEOUT_MS = 8000;

export function isGoogleRoutingConfigured() {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY);
}

async function googleRoute(from: LatLng, to: LatLng, departure: Date | null): Promise<RouteEstimate | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  const waypoint = (p: LatLng) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });
  try {
    const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
      },
      body: JSON.stringify({
        origin: waypoint(from),
        destination: waypoint(to),
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE_OPTIMAL",
        ...(departure ? { departureTime: departure.toISOString() } : {}),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error("Google Routes request failed:", res.status, await res.text());
      return null;
    }
    const route = (await res.json())?.routes?.[0];
    if (!route?.duration) return null;
    return {
      minutes: Math.ceil(parseInt(route.duration, 10) / 60),
      km: (route.distanceMeters ?? 0) / 1000,
      source: "google",
      polyline: route.polyline?.encodedPolyline ?? null,
    };
  } catch (err) {
    console.error("Google Routes request failed:", err);
    return null;
  }
}

async function fetchOsmRoute(from: LatLng, to: LatLng): Promise<RouteEstimate | null> {
  const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=simplified&geometries=polyline`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    const route = (await res.json())?.routes?.[0];
    if (!route) return null;
    return { minutes: Math.ceil(route.duration / 60), km: route.distance / 1000, source: "osm", polyline: route.geometry ?? null };
  } catch {
    return null;
  }
}

/** OSRM's public server has no uptime guarantee, so one blip gets one retry before a leg is left blank. */
async function osmRoute(from: LatLng, to: LatLng) {
  const first = await fetchOsmRoute(from, to);
  if (first) return first;
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return fetchOsmRoute(from, to);
}

export async function estimateRoute(from: LatLng, to: LatLng, departure: Date | null) {
  return (await googleRoute(from, to, departure)) ?? (await osmRoute(from, to));
}

/** The UTC instant of a wall-clock time in Prague, DST included. */
export function pragueInstant(date: string, minutes: number) {
  const [y, m, d] = date.split("-").map(Number);
  const asUtc = Date.UTC(y, m - 1, d, 0, minutes);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Prague",
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  }).formatToParts(new Date(asUtc));
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const shownAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return new Date(asUtc - (shownAsUtc - asUtc));
}

/**
 * Traffic prediction needs a future departure, so a date already past moves
 * forward whole weeks — same weekday and time, same typical traffic.
 */
export function nextPredictableDeparture(at: Date, now = new Date()) {
  const week = 7 * 24 * 60 * 60 * 1000;
  if (at.getTime() > now.getTime()) return at;
  return new Date(at.getTime() + Math.ceil((now.getTime() - at.getTime() + 60_000) / week) * week);
}

export function googleMapsUrl(from: LatLng, to: LatLng) {
  return `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}&travelmode=driving`;
}

/** The whole trip as one Google Maps route, up to Google's limit of 9 waypoints in a link. */
export function googleMapsTripUrl(points: LatLng[]) {
  const coord = (p: LatLng) => `${p.lat},${p.lng}`;
  const via = points.slice(1, -1).slice(0, 9).map(coord).join("|");
  const waypoints = via ? `&waypoints=${encodeURIComponent(via)}` : "";
  return `https://www.google.com/maps/dir/?api=1&origin=${coord(points[0])}&destination=${coord(points[points.length - 1])}${waypoints}&travelmode=driving`;
}

/** Stops one navigation link can hold: Google's limit of 9 waypoints plus the destination. */
export const GOOGLE_MAPS_MAX_STOPS = 10;

/**
 * Turn-by-turn navigation from the phone's own location through these stops, up
 * to GOOGLE_MAPS_MAX_STOPS. There's deliberately no origin: given one that isn't
 * near the phone, Google opens a route preview instead of navigating. Must stay
 * a plain link, because iOS only hands a URL to the Maps app on a direct tap.
 */
export function googleMapsNavigateUrl(stops: (LatLng | string)[]) {
  const place = (s: LatLng | string) => (typeof s === "string" ? s : `${s.lat},${s.lng}`);
  const route = stops.slice(0, GOOGLE_MAPS_MAX_STOPS).map(place);
  const via = route.slice(0, -1).join("|");
  const waypoints = via ? `&waypoints=${encodeURIComponent(via)}` : "";
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(route[route.length - 1])}${waypoints}&travelmode=driving&dir_action=navigate`;
}

/** Waze's official deep link. It has no start point: Waze routes from the phone's own location. */
export function wazeUrl(to: LatLng) {
  return `https://waze.com/ul?ll=${to.lat},${to.lng}&navigate=yes`;
}
