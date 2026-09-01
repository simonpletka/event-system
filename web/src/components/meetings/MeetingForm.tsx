"use client";

import { useActionState, useState } from "react";
import { createMeetingAction, updateMeetingAction, type MeetingFormState } from "@/lib/actions/meetings";
import { CancelLink } from "@/components/ui/CancelLink";
import { EventPicker } from "@/components/meetings/EventPicker";
import { isoDate } from "@/lib/calendar";
import { getDictionary, type Locale } from "@/lib/dictionary";
import type { MeetingType, RecurrenceFreq } from "@/generated/prisma/enums";

const initialState: MeetingFormState = {};

/** Same date<->input-value convention as RoadmapItemModal — a single field, "date" or "datetime-local" depending on allDay. */
function toLocalInput(d: Date, allDay: boolean) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return allDay ? date : `${date}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
  eventIds: string[];
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

      <label className="flex flex-col gap-1.5">
        <span className="field-label">{tf.titleLabel}</span>
        <input name="title" defaultValue={defaults.title} required autoFocus className="input" />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="field-label">{tf.typeLabel}</span>
        <select name="type" defaultValue={defaults.type} className="input">
          <option value="CLIENT">{t.meetings.typeClient}</option>
          <option value="INTERNAL">{t.meetings.typeInternal}</option>
        </select>
      </label>

      <input type="hidden" name="allDay" value={allDay ? "on" : ""} />
      <div className="flex items-end gap-3">
        <label className="flex flex-col gap-1.5 flex-1">
          <span className="field-label">{tf.dateLabel}</span>
          <input
            name="date"
            type={allDay ? "date" : "datetime-local"}
            defaultValue={toLocalInput(defaults.date, allDay)}
            required
            className="input"
          />
        </label>
        <label className="flex items-center gap-1.5 pb-2.5">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="accent-accent" />
          <span className="text-[12px]">{tf.allDayLabel}</span>
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="field-label">{tf.attendeesLabel}</span>
        <input name="attendees" defaultValue={defaults.attendees} placeholder={tf.attendeesPlaceholder} className="input" />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="field-label">{tf.noteLabel}</span>
        <textarea name="note" defaultValue={defaults.note} rows={3} className="input" />
      </label>

      <div className="flex flex-wrap gap-3 items-end">
        <label className="flex flex-col gap-1.5">
          <span className="field-label">{tf.recurrenceLabel}</span>
          <select name="recurrenceFreq" value={freq} onChange={(e) => setFreq(e.target.value as RecurrenceFreq)} className="input">
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
                className="input w-20"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="field-label">{tf.recurrenceUntilLabel}</span>
              <input
                name="recurrenceUntil"
                type="date"
                defaultValue={defaults.recurrenceUntil ? isoDate(defaults.recurrenceUntil) : ""}
                className="input"
              />
            </label>
          </>
        )}
      </div>

      <EventPicker
        options={eventOptions}
        defaultValue={defaults.eventIds}
        heading={tf.eventsHeading}
        note={tf.eventsNote}
        emptyLabel={tf.eventsEmpty}
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
