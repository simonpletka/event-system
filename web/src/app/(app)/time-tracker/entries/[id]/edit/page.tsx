import { notFound } from "next/navigation";
import { requireUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getLocale, getDictionary } from "@/lib/i18n";
import { EditEntryForm } from "@/components/timetracker/EditEntryForm";
import { isoDate } from "@/lib/calendar";

function isoTime(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default async function EditEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const t = getDictionary(await getLocale());

  const entry = await prisma.timeEntry.findFirst({
    where: { id, userId: user.id },
    include: { event: { select: { title: true } } },
  });
  if (!entry) notFound();
  if (entry.running) {
    return (
      <div>
        <h2 className="text-lg font-semibold mb-2">{t.timeTracker.entryEdit.editEntry}</h2>
        <p className="text-sm placeholder-text">{t.timeTracker.entryEdit.timerStillRunning}</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">{t.timeTracker.entryEdit.editEntry}</h2>
      <EditEntryForm
        id={entry.id}
        eventTitle={entry.event.title}
        date={isoDate(entry.date)}
        minutes={entry.minutes}
        description={entry.description}
        phase={entry.phase}
        startTime={entry.startedAt ? isoTime(entry.startedAt) : undefined}
        endTime={entry.endedAt ? isoTime(entry.endedAt) : undefined}
        t={t.timeTracker.editEntryForm}
        tPhases={t.phases}
      />
    </div>
  );
}
