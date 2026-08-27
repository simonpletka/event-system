/**
 * Pure URL builder for the Time Tracker Report page — no server-only
 * imports, so it can be shared between the page (a Server Component) and
 * the filter chips (Client Components, which can't receive a closure prop
 * built server-side per the RSC function-prop boundary).
 */
export type OverviewUrlParams = {
  period?: string;
  date?: string;
  users?: string;
  events?: string;
  clients?: string;
  q?: string;
  by?: string;
};

export function overviewHref(params: OverviewUrlParams) {
  const qs = new URLSearchParams();
  if (params.period) qs.set("period", params.period);
  if (params.date) qs.set("date", params.date);
  if (params.users) qs.set("users", params.users);
  if (params.events) qs.set("events", params.events);
  if (params.clients) qs.set("clients", params.clients);
  if (params.q) qs.set("q", params.q);
  if (params.by && params.by !== "person") qs.set("by", params.by);
  const s = qs.toString();
  return `/time-tracker/report${s ? `?${s}` : ""}`;
}
