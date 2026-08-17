import { requireUser } from "@/lib/authz";
import { getCompareEventsData } from "@/lib/queries/timetracker";
import { toCsv, csvResponse } from "@/lib/csv";
import { formatMinutes } from "@/lib/format";

export async function GET(req: Request) {
  const user = await requireUser();
  const ids = (new URL(req.url).searchParams.get("events") ?? "").split(",").filter(Boolean);
  const data = await getCompareEventsData(user, ids);

  if (!data) return csvResponse("compare-events.csv", toCsv(["Event", "Hours", "People", "Cost per hour"], []));

  const csv = toCsv(
    ["Event", "Hours", "People", "Quoted", "Cost per hour"],
    data.events.map((e) => [e.title, formatMinutes(e.totalMinutes), e.peopleCount, e.quotedValue, e.costPerHour])
  );

  return csvResponse(`compare-events-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}
