import { notFound } from "next/navigation";
import { requireUser } from "@/lib/authz";
import { getEventDetail } from "@/lib/queries/events";
import { formatDate, formatMinutes } from "@/lib/format";
import { PHASE_LABEL } from "@/lib/time-phases";

function liveMinutes(t: { running: boolean; minutes: number; startedAt: Date | null }) {
  if (!t.running || !t.startedAt) return t.minutes;
  return Math.max(1, Math.round((Date.now() - t.startedAt.getTime()) / 60000));
}

export default async function TimeTab({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const event = await getEventDetail(user, id);
  if (!event) notFound();

  const totalMinutes = event.timeEntries.reduce((s, t) => s + liveMinutes(t), 0);
  const byPerson = new Map<string, { name: string; minutes: number }>();
  for (const t of event.timeEntries) {
    const cur = byPerson.get(t.userId) ?? { name: t.user.name, minutes: 0 };
    cur.minutes += liveMinutes(t);
    byPerson.set(t.userId, cur);
  }

  return (
    <div className="max-w-2xl">
      <div className="flex justify-between text-sm mb-3">
        <span className="heading-label">Total logged</span>
        <span className="font-semibold">{formatMinutes(totalMinutes)}</span>
      </div>

      <div className="heading-label mb-1">By person</div>
      {[...byPerson.values()].map((p) => (
        <div key={p.name} className="flex justify-between py-1.5 border-b border-ink/10 text-[13px]">
          <div>{p.name}</div>
          <div className="placeholder-text">{formatMinutes(p.minutes)}</div>
        </div>
      ))}

      <div className="heading-label mt-4 mb-1">Entries</div>
      {event.timeEntries.length === 0 && <p className="text-sm placeholder-text">No time logged yet.</p>}
      {event.timeEntries.map((t) => (
        <div key={t.id} className="grid grid-cols-[80px_1fr_1fr_auto_auto] gap-2.5 items-center py-2 border-b border-ink/10 text-[13px]">
          <div className="placeholder-text">{formatDate(t.date)}</div>
          <div>{t.user.name}</div>
          <div className="placeholder-text">{t.description || "—"}</div>
          <div className="label">{PHASE_LABEL[t.phase]}</div>
          <div>
            {formatMinutes(liveMinutes(t))}
            {t.running && <span className="text-accent"> ●</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
