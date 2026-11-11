/**
 * Derives a trip's timetable from whichever times the user pinned. All values
 * are minutes after the trip date's local midnight (may exceed 1440 or go
 * negative for a trip crossing midnight). Stops before the first pinned stop
 * are worked out backwards from it, everything after it forwards.
 */
export type ScheduleInput = {
  arriveMin: number | null;
  departMin: number | null;
  stayMinutes: number | null;
  /** Drive from the previous stop, buffer included. Null when unknown. */
  driveMinutes: number | null;
};

export type ScheduledStop = {
  arrive: number | null;
  depart: number | null;
  /** Spare time before a pinned arrival. */
  waitMinutes: number;
  /** How far past a pinned time this stop ends up. */
  lateMinutes: number;
};

export type Schedule = {
  stops: ScheduledStop[];
  /** Null when no stop has a pinned time yet. */
  start: number | null;
  end: number | null;
  /** True when a leg's drive time is unknown, so times around it are approximate. */
  incomplete: boolean;
};

export function driveWithBuffer(leg: { manualMinutes: number | null; legMinutes: number | null }, bufferMinutes: number) {
  if (leg.manualMinutes != null) return leg.manualMinutes;
  return leg.legMinutes == null ? null : leg.legMinutes + bufferMinutes;
}

export function buildSchedule(input: ScheduleInput[]): Schedule {
  const stops: ScheduledStop[] = input.map(() => ({ arrive: null, depart: null, waitMinutes: 0, lateMinutes: 0 }));
  const anchor = input.findIndex((s) => s.arriveMin != null || s.departMin != null);
  if (anchor === -1) return { stops, start: null, end: null, incomplete: false };

  let incomplete = false;
  const drive = (i: number) => {
    const minutes = input[i].driveMinutes;
    if (minutes == null) incomplete = true;
    return minutes ?? 0;
  };

  const first = input[anchor];
  const stay = first.stayMinutes ?? 0;
  stops[anchor].arrive = first.arriveMin ?? first.departMin! - stay;
  stops[anchor].depart = first.departMin ?? first.arriveMin! + stay;

  for (let i = anchor - 1; i >= 0; i--) {
    const depart = stops[i + 1].arrive! - drive(i + 1);
    stops[i].depart = depart;
    stops[i].arrive = depart - (input[i].stayMinutes ?? 0);
  }

  for (let i = anchor + 1; i < input.length; i++) {
    const s = input[i];
    const eta = stops[i - 1].depart! + drive(i);
    const stayHere = s.stayMinutes ?? 0;
    if (s.arriveMin != null) {
      stops[i].arrive = Math.max(eta, s.arriveMin);
      stops[i].waitMinutes = Math.max(0, s.arriveMin - eta);
      stops[i].lateMinutes = Math.max(0, eta - s.arriveMin);
      stops[i].depart = s.departMin != null ? Math.max(s.departMin, stops[i].arrive!) : stops[i].arrive! + stayHere;
    } else if (s.departMin != null) {
      stops[i].arrive = eta;
      stops[i].lateMinutes = Math.max(0, eta - s.departMin);
      stops[i].depart = Math.max(eta, s.departMin);
    } else {
      stops[i].arrive = eta;
      stops[i].depart = eta + stayHere;
    }
  }

  const last = input.length - 1;
  const lastStop = input[last];
  // The final stop ends the trip on arrival unless it has its own stay/leave time.
  const end = lastStop.departMin != null || lastStop.stayMinutes != null ? stops[last].depart : stops[last].arrive;
  return { stops, start: stops[0].depart, end, incomplete };
}

/** `start` is minutes after the trip day's midnight, or null without a timetable. */
export type RentalSegment = { minutes: number; km: number; start: number | null };

/**
 * One carsharing rental per run of legs between split stops. A rental runs
 * from leaving its first stop to arriving at its last, so a stay at a split
 * stop is unbilled and any stay inside a rental is billed. Without a pinned
 * time there's no timetable, so a segment falls back to its driving time.
 */
export function rentalSegments(
  stops: { splitRental: boolean; legKm: number | null }[],
  schedule: Schedule,
  driveMinutes: (number | null)[]
): RentalSegment[] {
  const segments: RentalSegment[] = [];
  const last = stops.length - 1;
  let start = 0;
  for (let i = 1; i <= last; i++) {
    if (i !== last && !stops[i].splitRental) continue;
    const legs = stops.slice(start + 1, i + 1);
    const drives = driveMinutes.slice(start + 1, i + 1);
    const from = schedule.stops[start].depart;
    const to = i === last ? schedule.end : schedule.stops[i].arrive;
    segments.push({
      minutes: from != null && to != null ? to - from : drives.reduce<number>((sum, d) => sum + (d ?? 0), 0),
      km: legs.reduce((sum, s) => sum + (s.legKm ?? 0), 0),
      start: from != null && to != null ? from : null,
    });
    start = i;
  }
  return segments;
}

export function formatClock(minutes: number) {
  const day = 1440;
  const wrapped = ((minutes % day) + day) % day;
  const dayOffset = Math.floor(minutes / day);
  const clock = `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
  return dayOffset === 0 ? clock : `${clock} (${dayOffset > 0 ? "+" : ""}${dayOffset})`;
}

export function parseClock(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
}
