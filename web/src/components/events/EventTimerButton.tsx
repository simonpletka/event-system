"use client";

import { startTimerAction } from "@/lib/actions/timetracker";
import { useStopTimerAction } from "@/hooks/useStopTimerAction";

/**
 * Icon-only start/stop button for the event Overview time card — same
 * play/stop treatment as the sidebar TimerWidget. Shows the stop state only
 * when the running timer belongs to this event.
 */
export function EventTimerButton({
  eventId,
  running,
  startLabel,
  stopLabel,
  discardedMessage,
}: {
  eventId: string;
  running: boolean;
  startLabel: string;
  stopLabel: string;
  discardedMessage: string;
}) {
  const { formAction: stopAction } = useStopTimerAction(discardedMessage);

  if (running) {
    return (
      <form action={stopAction}>
        <button
          type="submit"
          title={stopLabel}
          className="w-[27px] h-[27px] rounded-lg border border-ink/20 bg-ink/5 flex items-center justify-center hover:bg-ink/10 transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 24 24">
            <rect x="3" y="3" width="18" height="18" rx="3" fill="currentColor" className="text-ink/85" />
          </svg>
        </button>
      </form>
    );
  }

  return (
    <form action={startTimerAction}>
      <input type="hidden" name="eventId" value={eventId} />
      <button
        type="submit"
        title={startLabel}
        className="w-[27px] h-[27px] rounded-lg bg-accent flex items-center justify-center hover:opacity-90 transition-opacity"
      >
        <svg width="10" height="10" viewBox="0 0 24 24">
          <path d="M7 4v16l14-8Z" fill="currentColor" className="text-ink" />
        </svg>
      </button>
    </form>
  );
}
