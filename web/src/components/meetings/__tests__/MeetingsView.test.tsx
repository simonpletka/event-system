import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
// The real action imports Prisma, and the real button needs the dialog provider.
vi.mock("@/lib/actions/meetings", () => ({ deleteMeetingAction: vi.fn() }));
vi.mock("@/components/ui/ConfirmDeleteButton", () => ({
  ConfirmDeleteButton: ({ label }: { label: string }) => <button type="button">{label}</button>,
}));

const { MeetingsView } = await import("../MeetingsView");

const base = { allDay: false, attendees: "", note: "", recurrenceFreq: "NONE" as const, recurrenceInterval: 1, recurrenceUntil: null, projects: [] };
const meetings = [
  { ...base, id: "a", title: "Past review", type: "INTERNAL" as const, date: "2026-11-02T09:00:00.000Z", past: true },
  { ...base, id: "b", title: "Client call", type: "CLIENT" as const, date: "2026-11-08T14:00:00.000Z", past: false, attendees: "Jana, Petr", projects: [{ id: "p", title: "Winter gala", href: "/projects/26-001" }] },
  { ...base, id: "c", title: "Team sync", type: "INTERNAL" as const, date: "2026-11-09T08:00:00.000Z", past: false, recurrenceFreq: "WEEKLY" as const },
  { ...base, id: "d", title: "Site visit", type: "CLIENT" as const, date: "2026-11-20T10:00:00.000Z", past: false },
];

function renderView(rows = meetings, canManage = true) {
  render(<MeetingsView meetings={rows} today="2026-11-08" tomorrow="2026-11-09" initialFilter="ALL" canManage={canManage} locale="en" />);
}
const list = () => screen.getByRole("region", { name: "Upcoming and past" });
const rowTitles = () => within(list()).getAllByRole("button").map((b) => b.querySelector(".font-semibold")?.textContent);

afterEach(cleanup);

describe("meetings page", () => {
  it("groups by day as Today, Tomorrow then the date, with past meetings last", () => {
    renderView();
    expect(within(list()).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Today",
      "Tomorrow",
      "Friday, 20 November 2026",
      "Monday, 2 November 2026",
    ]);
    const past = within(list()).getByRole("button", { name: /Past review/ });
    expect(past.className).toContain("opacity-50");
  });

  it("filters by type and selects the first remaining row", () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "Internal" }));
    expect(rowTitles()).toEqual(["Team sync", "Past review"]);
    expect(screen.getByRole("region", { name: "Team sync" })).toBeTruthy();
    expect(window.location.search).toBe("?type=INTERNAL");
  });

  it("shows the selected meeting's details and links its projects", () => {
    renderView();
    const detail = screen.getByRole("region", { name: "Client call" });
    expect(within(detail).getByText("Jana, Petr")).toBeTruthy();
    expect(within(detail).getByRole("link", { name: "Winter gala" }).getAttribute("href")).toBe("/projects/26-001");

    fireEvent.click(within(list()).getByRole("button", { name: /Team sync/ }));
    expect(within(screen.getByRole("region", { name: "Team sync" })).getByText("Every week")).toBeTruthy();
  });

  it("marks past meetings in the detail panel", () => {
    renderView();
    fireEvent.click(within(list()).getByRole("button", { name: /Past review/ }));
    expect(within(screen.getByRole("region", { name: "Past review" })).getAllByText("Past").length).toBe(1);
  });

  it("shows the empty state with New meeting when a filter has nothing", () => {
    renderView(meetings.filter((m) => m.type === "CLIENT"));
    fireEvent.click(screen.getByRole("button", { name: "Internal" }));
    expect(screen.getByText("No meetings yet.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "New meeting" }).getAttribute("href")).toBe("/meetings/new");
  });

  it("hides Edit, Delete and New meeting without permission", () => {
    renderView(meetings, false);
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Edit" })).toBeNull();
  });
});
