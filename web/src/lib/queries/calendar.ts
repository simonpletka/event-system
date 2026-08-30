import { prisma } from "@/lib/prisma";
import { eventWhereForUser, type SessionUser } from "@/lib/authz";
import { addDays } from "@/lib/calendar";

export async function getWeekCalendarData(user: SessionUser, weekStart: Date) {
  const weekEnd = addDays(weekStart, 7);

  const events = await prisma.event.findMany({
    where: {
      ...eventWhereForUser(user),
      status: { not: "CANCELLED" },
      OR: [
        // event's effective range (build..strike, falling back to start..end) overlaps the week —
        // shows up in the all-day band
        {
          AND: [
            { OR: [{ buildDate: { lt: weekEnd } }, { buildDate: null, startDate: { lt: weekEnd } }] },
            { OR: [{ strikeDate: { gte: weekStart } }, { strikeDate: null, endDate: { gte: weekStart } }] },
          ],
        },
        // ...or it just has a milestone this week (e.g. an early planning call, weeks before build)
        { roadmapItems: { some: { type: "MILESTONE", date: { gte: weekStart, lt: weekEnd } } } },
      ],
    },
    include: {
      roadmapItems: { where: { type: "MILESTONE", date: { gte: weekStart, lt: weekEnd } } },
      venues: true,
    },
    orderBy: { startDate: "asc" },
  });

  return events;
}
