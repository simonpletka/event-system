import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const rescheduleProject = vi.fn();
const rescheduleItem = vi.fn();
vi.mock("@/lib/actions/projects", () => ({ rescheduleProjectAction: rescheduleProject }));
vi.mock("@/lib/actions/roadmap", () => ({ rescheduleRoadmapItemAction: rescheduleItem }));
vi.mock("@/lib/actions/meetings", () => ({
  rescheduleMeetingAction: vi.fn(),
  rescheduleMeetingOccurrenceAction: vi.fn(),
  splitMeetingSeriesAction: vi.fn(),
}));

const { WeekCalendar } = await import("../WeekCalendar");

// jsdom has no PointerEvent or layout: give it both, with 100px day columns and 72px hours from (0,0).
class TestPointerEvent extends MouseEvent {
  pointerId: number;
  pointerType: string;
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
    this.pointerType = init.pointerType ?? "mouse";
  }
}
beforeEach(() => {
  vi.stubGlobal("PointerEvent", TestPointerEvent);
  window.PointerEvent = TestPointerEvent as unknown as typeof PointerEvent;
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, right: 744, bottom: 1728, width: 744, height: 1728, x: 0, y: 0, toJSON: () => ({}) });
  rescheduleProject.mockReset().mockResolvedValue({ ok: true });
  rescheduleItem.mockReset().mockResolvedValue({ ok: true });
  push.mockReset();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const project = {
  id: "p1",
  number: "26-003",
  title: "Lumen launch",
  client: "Acme",
  status: "CONFIRMED" as const,
  value: 120000,
  place: "Forum Karlín",
  address: null,
  editable: true,
  buildDate: null,
  // 2026-11-09 is a Monday.
  startDate: "2026-11-10T00:00:00.000Z",
  endDate: "2026-11-12T00:00:00.000Z",
  strikeDate: null,
  milestones: [{ id: "m1", title: "Rehearsal", date: "2026-11-10T09:00:00.000Z", allDay: false }], // 10:00 Prague
};
const other = { ...project, id: "p2", number: "26-004", title: "Winter gala", startDate: "2026-11-11T00:00:00.000Z", endDate: "2026-11-11T00:00:00.000Z", milestones: [] };

function renderCalendar(events = [project, other]) {
  render(<WeekCalendar weekKey="2026-11-09" today="2026-11-11" events={events} meetings={[]} locale="en" />);
}
const bar = (name: RegExp) => screen.getByRole("link", { name });
const milestone = () => bar(/26-003 · Lumen launch, Tue.*Rehearsal/);
const barLink = () => bar(/^26-003 · Lumen launch, 10 Nov – 12 Nov/);

function drag(el: Element, from: [number, number], to: [number, number], pointerType = "mouse") {
  const opts = { pointerId: 1, pointerType, button: 0 };
  fireEvent.pointerDown(el, { ...opts, clientX: from[0], clientY: from[1] });
  fireEvent.pointerMove(el, { ...opts, clientX: to[0], clientY: to[1] });
  fireEvent.pointerUp(el, { ...opts, clientX: to[0], clientY: to[1] });
}

describe("week calendar", () => {
  it("runs Monday to Sunday and marks today with the orange circle", () => {
    renderCalendar();
    const today = screen.getByText("11");
    expect(today.className).toContain("bg-accent");
    expect(screen.getByText("9").className).not.toContain("bg-accent");
    expect(screen.getByText("15")).toBeTruthy();
  });

  it("stacks overlapping all-day events in lanes and shows code and name", () => {
    renderCalendar();
    expect(barLink().style.gridRow).toContain("1");
    expect(bar(/^26-004 · Winter gala/).style.gridRow).toContain("2");
  });

  it("shows the hover card for a mouse, and hides it on leave and when a drag starts", () => {
    renderCalendar();
    fireEvent.pointerEnter(barLink(), { pointerType: "mouse", clientX: 50, clientY: 50 });
    const card = within(screen.getByTestId("calendar-hover-card"));
    expect(card.getByText("26-003 · Project days")).toBeTruthy();
    expect(card.getByText("Lumen launch")).toBeTruthy();
    expect(card.getByText("Forum Karlín")).toBeTruthy();
    expect(card.getByText("Acme")).toBeTruthy();
    expect(card.getByText("Value (excl. VAT)")).toBeTruthy();

    fireEvent.pointerLeave(barLink());
    expect(screen.queryByTestId("calendar-hover-card")).toBeNull();

    fireEvent.pointerEnter(barLink(), { pointerType: "touch", clientX: 50, clientY: 50 });
    expect(screen.queryByTestId("calendar-hover-card")).toBeNull();

    fireEvent.pointerEnter(milestone(), { pointerType: "mouse", clientX: 50, clientY: 50 });
    expect(screen.getByTestId("calendar-hover-card")).toBeTruthy();
    fireEvent.pointerDown(milestone(), { pointerId: 1, button: 0, clientX: 150, clientY: 725 });
    fireEvent.pointerMove(milestone(), { pointerId: 1, clientX: 150, clientY: 760 });
    expect(screen.queryByTestId("calendar-hover-card")).toBeNull();
    fireEvent.pointerUp(milestone(), { pointerId: 1, clientX: 150, clientY: 725 });
  });

  it("opens the project with Space", () => {
    renderCalendar();
    fireEvent.keyDown(milestone(), { key: " " });
    expect(push).toHaveBeenCalledWith("/projects/26-003-lumen-launch");
  });

  it("moves a timed event to another day in 15-minute steps", async () => {
    renderCalendar();
    const el = milestone();
    // Grabbed on Tuesday at 10:00, released on Wednesday 40px lower: +33 minutes snaps to +30.
    drag(el, [194, 720], [294, 760]);
    await waitFor(() => expect(rescheduleItem).toHaveBeenCalledTimes(1));
    const fd = rescheduleItem.mock.calls[0][0] as FormData;
    expect(fd.get("itemId")).toBe("m1");
    expect(fd.get("date")).toBe("2026-11-11T09:30:00.000Z");
    expect(await screen.findByRole("status")).toBeTruthy();
  });

  it("moves all-day events by day only, through the project reschedule", async () => {
    renderCalendar();
    const el = barLink();
    drag(el, [150, 10], [350, 200], "touch");
    // false: the click that ends the drag was cancelled, so the project doesn't open.
    expect(fireEvent.click(el)).toBe(false);
    await waitFor(() => expect(rescheduleProject).toHaveBeenCalledTimes(1));
    const fd = rescheduleProject.mock.calls[0][0] as FormData;
    expect(fd.get("id")).toBe("p1");
    expect(fd.get("deltaDays")).toBe("2");
  });

  it("puts the event back and says so when the save fails", async () => {
    rescheduleItem.mockResolvedValue({ ok: false });
    renderCalendar();
    drag(milestone(), [194, 720], [294, 720]);
    expect(await screen.findByText(/Couldn't save the move/)).toBeTruthy();
    await act(async () => {});
    expect(milestone().getAttribute("aria-label")).toContain("Tue, 10 Nov");
  });

  it("does not make read-only events draggable, but they still open", () => {
    renderCalendar([{ ...project, editable: false }]);
    expect(barLink().className).not.toContain("touch-none");
    drag(barLink(), [150, 10], [350, 10]);
    expect(rescheduleProject).not.toHaveBeenCalled();
    expect(fireEvent.click(barLink())).toBe(true);
  });

  it("does not move or save when released in the same place", () => {
    renderCalendar();
    drag(barLink(), [150, 10], [160, 12]);
    expect(rescheduleProject).not.toHaveBeenCalled();
  });
});
