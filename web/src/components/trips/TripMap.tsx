"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

type MapStop = { lat: number | null; lng: number | null; polyline: string | null };

/** Google's encoded polyline format, precision 5 — what both routing sources return. */
function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const nextDelta = () => {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (index < encoded.length) {
    lat += nextDelta();
    lng += nextDelta();
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

/**
 * Read-only preview of a trip's route, numbered like the schedule. Leaflet
 * touches `window` on import, so it loads inside the effect. A stop visited
 * twice shares one marker ("2, 4"), and a leg without stored geometry falls
 * back to a dashed straight line.
 */
export function TripMap({ stops, label }: { stops: MapStop[]; label: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const data = JSON.stringify(stops);

  useEffect(() => {
    let cancelled = false;
    let map: import("leaflet").Map | undefined;

    import("leaflet").then(({ default: L }) => {
      if (cancelled || !containerRef.current) return;
      const parsed: MapStop[] = JSON.parse(data);
      const accent = getComputedStyle(containerRef.current).getPropertyValue("--color-accent").trim();
      map = L.map(containerRef.current, { scrollWheelZoom: false });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      }).addTo(map);

      const bounds = L.latLngBounds([]);
      const markers = new Map<string, { at: [number, number]; numbers: number[] }>();
      parsed.forEach((stop, i) => {
        if (stop.lat == null || stop.lng == null) return;
        const at: [number, number] = [stop.lat, stop.lng];
        bounds.extend(at);
        const key = at.join(",");
        markers.set(key, { at, numbers: [...(markers.get(key)?.numbers ?? []), i + 1] });

        const previous = parsed[i - 1];
        if (!previous) return;
        if (stop.polyline) {
          const line = decodePolyline(stop.polyline);
          line.forEach((p) => bounds.extend(p));
          L.polyline(line, { color: accent, weight: 4, opacity: 0.9 }).addTo(map!);
        } else if (previous.lat != null && previous.lng != null) {
          L.polyline([[previous.lat, previous.lng], at], { color: accent, weight: 2, dashArray: "6 6" }).addTo(map!);
        }
      });

      for (const { at, numbers } of markers.values()) {
        const text = numbers.join(", ");
        const width = Math.max(22, text.length * 8 + 8);
        L.marker(at, {
          icon: L.divIcon({ className: "trip-map-marker", html: text, iconSize: [width, 22], iconAnchor: [width / 2, 11] }),
          keyboard: false,
        }).addTo(map);
      }
      map.fitBounds(bounds, { padding: [24, 24] });
    });

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [data]);

  return <div ref={containerRef} role="img" aria-label={label} className="trip-map relative z-0 h-[260px] md:h-[320px] rounded-xl overflow-hidden" />;
}
