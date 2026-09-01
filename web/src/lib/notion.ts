import { Client } from "@notionhq/client";
import { isoDate } from "@/lib/calendar";
import type { EventStatus, MeetingType } from "@/generated/prisma/enums";

export class NotionNotConfiguredError extends Error {
  constructor() {
    super("Notion sync isn't configured yet — set NOTION_API_KEY and the relevant NOTION_*_DATABASE_ID in the environment.");
    this.name = "NotionNotConfiguredError";
  }
}

let notionClient: Client | null = null;

function getNotion(): Client | null {
  if (notionClient) return notionClient;
  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) return null;
  notionClient = new Client({ auth: apiKey });
  return notionClient;
}

// Title-case labels matching the Status select options already created in
// the Notion Events database — deliberately not dictionary.ts's EN labels
// (those use sentence case, e.g. "Quote sent"), since matching an existing
// select option by exact string is what avoids Notion silently creating a
// near-duplicate option on every mismatch.
const NOTION_STATUS_LABEL: Record<EventStatus, string> = {
  INQUIRY: "Inquiry",
  QUOTE_SENT: "Quote Sent",
  CONFIRMED: "Confirmed",
  IN_PROGRESS: "In Progress",
  TO_INVOICE: "To Invoice",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

function richText(content: string) {
  return { rich_text: [{ text: { content } }] };
}

type NotionEvent = {
  id: string;
  title: string;
  companyName: string;
  status: EventStatus;
  startDate: Date;
  endDate: Date;
  number: string;
};

/**
 * Creates a page in the Notion Events database and returns its page id.
 * Throws NotionNotConfiguredError when NOTION_API_KEY/NOTION_EVENTS_DATABASE_ID
 * are unset — callers on the hot path should use tryCreateNotionEventPage instead.
 */
export async function createNotionEventPage(event: NotionEvent): Promise<string> {
  const notion = getNotion();
  const databaseId = process.env.NOTION_EVENTS_DATABASE_ID;
  if (!notion || !databaseId) throw new NotionNotConfiguredError();

  const appLink = `${process.env.APP_BASE_URL ?? "http://localhost:3000"}/events/${event.id}`;
  const page = await notion.pages.create({
    parent: { database_id: databaseId },
    properties: {
      Name: { title: [{ text: { content: event.title } }] },
      Client: richText(event.companyName),
      Status: { select: { name: NOTION_STATUS_LABEL[event.status] } },
      "Start Date": { date: { start: isoDate(event.startDate) } },
      "End Date": { date: { start: isoDate(event.endDate) } },
      "Event Number": richText(event.number),
      "App Link": { url: appLink },
    },
  });
  return page.id;
}

/** Best-effort wrapper: never throws, so a Notion hiccup never fails event creation. Returns the new page id on success, or null. */
export async function tryCreateNotionEventPage(event: NotionEvent): Promise<string | null> {
  try {
    return await createNotionEventPage(event);
  } catch (e) {
    if (e instanceof NotionNotConfiguredError) return null;
    console.error("Notion event page creation failed:", e);
    return null;
  }
}

type NotionMeeting = {
  type: MeetingType;
  title: string;
  date: Date;
  allDay: boolean;
  attendees: string;
};

const MEETING_DATABASE_ENV: Record<MeetingType, string> = {
  CLIENT: "NOTION_CLIENT_MEETINGS_DATABASE_ID",
  INTERNAL: "NOTION_INTERNAL_MEETINGS_DATABASE_ID",
};

/**
 * Creates a page in the Client Meetings or Internal Meetings Notion database
 * (by meeting.type). `linkedEventPageIds` are the Notion page ids of events
 * already synced (Event.notionPageId) — events with no known page (Notion
 * wasn't configured, or that event predates Notion sync) are just omitted
 * from the Events relation rather than blocking the meeting page. `clientName`
 * (Client Meetings only) is derived by the caller from the first linked
 * event's companyName, since a Meeting itself doesn't store one (it can span
 * several events, possibly for different clients).
 */
export async function createNotionMeetingPage(
  meeting: NotionMeeting,
  opts: { linkedEventPageIds: string[]; clientName?: string }
): Promise<string> {
  const notion = getNotion();
  const databaseId = process.env[MEETING_DATABASE_ENV[meeting.type]];
  if (!notion || !databaseId) throw new NotionNotConfiguredError();

  const dateValue = meeting.allDay ? isoDate(meeting.date) : meeting.date.toISOString();
  const properties: Record<string, unknown> = {
    Name: { title: [{ text: { content: meeting.title } }] },
    Date: { date: { start: dateValue } },
    Attendees: richText(meeting.attendees),
  };
  if (opts.linkedEventPageIds.length > 0) {
    properties.Events = { relation: opts.linkedEventPageIds.map((id) => ({ id })) };
  }
  if (meeting.type === "CLIENT") {
    properties.Client = richText(opts.clientName ?? "");
  }

  const page = await notion.pages.create({
    parent: { database_id: databaseId },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- property shape varies by meeting type, built above
    properties: properties as any,
  });
  return page.id;
}

/** Best-effort wrapper: never throws, so a Notion hiccup never fails meeting creation. */
export async function tryCreateNotionMeetingPage(
  meeting: NotionMeeting,
  opts: { linkedEventPageIds: string[]; clientName?: string }
): Promise<void> {
  try {
    await createNotionMeetingPage(meeting, opts);
  } catch (e) {
    if (e instanceof NotionNotConfiguredError) return;
    console.error("Notion meeting page creation failed:", e);
  }
}
