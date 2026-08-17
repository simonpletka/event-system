import { notFound } from "next/navigation";
import { requireUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { EditEntryForm } from "@/components/timetracker/EditEntryForm";

export default async function EditEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const entry = await prisma.timeEntry.findFirst({
    where: { id, userId: user.id },
    include: { event: { select: { title: true } } },
  });
  if (!entry) notFound();
  if (entry.running) {
    return (
      <div>
        <h2 className="text-lg font-semibold mb-2">Edit entry</h2>
        <p className="text-sm placeholder-text">This timer is still running — stop it first from the Tracking tab.</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">Edit entry</h2>
      <EditEntryForm
        id={entry.id}
        eventTitle={entry.event.title}
        date={entry.date.toISOString().slice(0, 10)}
        minutes={entry.minutes}
        description={entry.description}
        phase={entry.phase}
      />
    </div>
  );
}
