"use client";

import { useActionState, useState } from "react";
import { createMeetingAction, updateMeetingAction, type MeetingFormState } from "@/lib/actions/meetings";
import { CancelLink } from "@/components/ui/CancelLink";
import { MeetingProjectPicker } from "@/components/meetings/MeetingProjectPicker";
import { isoDate } from "@/lib/calendar";
import { toPragueInput } from "@/lib/prague-date";
import { getDictionary, type Locale } from "@/lib/dictionary";
import type { MeetingType, RecurrenceFreq } from "@/generated/prisma/enums";

const initialState: MeetingFormState = {};

/** A single field, "date" or "datetime-local" depending on allDay, always in Prague time so server and browser agree. */
function toLocalInput(d: Date, allDay: boolean) {
  return toPragueInput(d, !allDay);
}

export type MeetingFormDefaults = {
  id?: string;
  title: string;
  type: MeetingType;
  date: Date;
  allDay: boolean;
  attendees: string;
  note: string;
  recurrenceFreq: RecurrenceFreq;
  recurrenceInterval: number;
  recurrenceUntil: Date | null;
  projectIds: string[];
};

export function MeetingForm({
  defaults,
  eventOptions,
  locale,
}: {
  defaults: MeetingFormDefaults;
  eventOptions: { id: string; title: string }[];
  locale: Locale;
}) {
  const t = getDictionary(locale);
  const tf = t.meetings.form;
  const isEdit = Boolean(defaults.id);
  const action = isEdit ? updateMeetingAction : createMeetingAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [freq, setFreq] = useState<RecurrenceFreq>(defaults.recurrenceFreq);
  const [allDay, setAllDay] = useState(defaults.allDay);

  return (
    <form action={formAction} className="card w-full flex flex-col gap-4 p-6">
      {isEdit && <input type="hidden" name="id" value={defaults.id} />}

      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4">
        <label className="flex flex-col gap-1.5 min-w-0">
          <span className="field-label">{tf.titleLabel}</span>
          <input name="title" defaultValue={defaults.title} required autoFocus className="input w-full" />
        </label>

        <label className="flex flex-col gap-1.5 min-w-0">
          <span className="field-label">{tf.typeLabel}</span>
          <select name="type" defaultValue={defaults.type} className="input w-full">
            <option value="CLIENT">{t.meetings.typeClient}</option>
            <option value="INTERNAL">{t.meetings.typeInternal}</option>
          </select>
        </label>
      </div>

      <input type="hidden" name="allDay" value={allDay ? "on" : ""} />
      <div className="flex flex-col md:flex-row md:items-end gap-3">
        <label className="flex flex-col gap-1.5 flex-1 min-w-0">
          <span className="field-label">{tf.dateLabel}</span>
          <input
            name="date"
            type={allDay ? "date" : "datetime-local"}
            defaultValue={toLocalInput(defaults.date, allDay)}
            required
            className="input w-full"
          />
        </label>
        <label className="flex items-center gap-1.5 md:pb-2.5">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="accent-accent" />
          <span className="text-[12px]">{tf.allDayLabel}</span>
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="field-label">{tf.attendeesLabel}</span>
        <input name="attendees" defaultValue={defaults.attendees} placeholder={tf.attendeesPlaceholder} className="input w-full" />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="field-label">{tf.noteLabel}</span>
        <textarea name="note" defaultValue={defaults.note} rows={3} className="input w-full" />
      </label>

      <div className="flex flex-col md:flex-row md:flex-wrap gap-3 md:items-end">
        <label className="flex flex-col gap-1.5">
          <span className="field-label">{tf.recurrenceLabel}</span>
          <select name="recurrenceFreq" value={freq} onChange={(e) => setFreq(e.target.value as RecurrenceFreq)} className="input w-full">
            <option value="NONE">{tf.recurrenceNone}</option>
            <option value="DAILY">{tf.recurrenceDaily}</option>
            <option value="WEEKLY">{tf.recurrenceWeekly}</option>
            <option value="MONTHLY">{tf.recurrenceMonthly}</option>
          </select>
        </label>
        {freq !== "NONE" && (
          <>
            <label className="flex flex-col gap-1.5">
              <span className="field-label">{tf.recurrenceIntervalLabel}</span>
              <input
                name="recurrenceInterval"
                type="number"
                min={1}
                defaultValue={defaults.recurrenceInterval}
                className="input w-full md:w-20"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="field-label">{tf.recurrenceUntilLabel}</span>
              <input
                name="recurrenceUntil"
                type="date"
                defaultValue={defaults.recurrenceUntil ? isoDate(defaults.recurrenceUntil) : ""}
                className="input w-full"
              />
            </label>
          </>
        )}
      </div>

      <MeetingProjectPicker
        options={eventOptions}
        defaultValue={defaults.projectIds}
        heading={tf.projectsHeading}
        note={tf.projectsNote}
        emptyLabel={tf.projectsEmpty}
      />

      {state.error && <p className="text-sm text-warning">{state.error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn">
          {pending ? tf.saving : isEdit ? tf.saveChanges : tf.createMeeting}
        </button>
        <CancelLink href={isEdit ? "/meetings" : "/meetings"} label={t.common.cancel} />
      </div>
    </form>
  );
}
