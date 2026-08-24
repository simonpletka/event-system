"use client";

import { useActionState, useEffect } from "react";
import { stopTimerAction, type TimeFormState } from "@/lib/actions/timetracker";
import { useConfirmDialog } from "@/components/ui/ConfirmDialogProvider";

const initialState: TimeFormState = {};

/**
 * Wraps stopTimerAction with useActionState so the "discarded — ran under
 * 10s" outcome (see MIN_TIMER_SECONDS in actions/timetracker.ts) can surface
 * an in-app notice instead of silently vanishing. Shared between the
 * sidebar TimerWidget and the tracking page's RunningTimerBox.
 */
export function useStopTimerAction(discardedMessage: string) {
  const [state, formAction, pending] = useActionState(stopTimerAction, initialState);
  const { notify } = useConfirmDialog();

  useEffect(() => {
    if (state.discardedTooShort) notify(discardedMessage);
    // notify comes from context (stable across renders) and discardedMessage is static per caller — re-firing only on the actual signal changing is correct.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.discardedTooShort]);

  return { formAction, pending };
}
