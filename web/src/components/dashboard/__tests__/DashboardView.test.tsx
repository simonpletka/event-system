import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { DashProject } from "@/lib/dashboard-types";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
// The real action imports Prisma; these tests only exercise the client side.
vi.mock("@/lib/actions/roadmap", () => ({ toggleRoadmapItemDoneAction: vi.fn() }));

const { DashboardView } = await import("../DashboardView");

function project(overrides: Partial<DashProject>): DashProject {
  return {
    id: "p1",
    number: "26-001",
    title: "Winter gala",
    client: "Nová Hora a.s.",
    status: "CONFIRMED",
    start: "2026-11-18T17:00:00.000Z",
    end: "2026-11-18T22:00:00.000Z",
    venue: "Žofín Palace",
    nextMilestone: null,
    href: "/projects/26-001-winter-gala",
    ...overrides,
  };
}

const november = project({});
const december = project({ id: "p2", number: "26-002", title: "Year-end party", start: "2026-12-11T17:00:00.000Z", end: "2026-12-11T22:00:00.000Z" });
const pastProject = project({ id: "p3", number: "26-003", title: "Summer festival", client: "Městská kultura", status: "TO_INVOICE", start: "2026-09-12T10:00:00.000Z", end: "2026-09-12T21:00:00.000Z", venue: "Náplavka" });

function renderDashboard(overrides: Partial<React.ComponentProps<typeof DashboardView>> = {}) {
  const loadMonth = vi.fn(async (month: string) => (month === "2026-12" ? [december] : []));
  render(
    <DashboardView
      locale="en"
      today="2026-11-08"
      upcoming={[november]}
      month={{ key: "2026-11", projects: [november] }}
      loadMonth={loadMonth}
      tasks={[]}
      meetings={[]}
      canCreateMeeting={false}
      finance={null}
      expenses={[]}
      {...overrides}
    />
  );
  return { loadMonth };
}

afterEach(cleanup);

describe("dashboard calendar", () => {
  it("switches months, loading each month's projects once", async () => {
    const { loadMonth } = renderDashboard();
    fireEvent.click(screen.getByRole("tab", { name: "Calendar" }));

    expect(screen.getByRole("heading", { name: "November 2026" })).toBeTruthy();
    expect(within(screen.getByRole("grid")).getByRole("button", { name: "Winter gala" })).toBeTruthy();

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Next month" })));
    expect(loadMonth).toHaveBeenCalledWith("2026-12");
    expect(screen.getByRole("heading", { name: "December 2026" })).toBeTruthy();
    const grid = screen.getByRole("grid");
    expect(within(grid).getByRole("button", { name: "Year-end party" })).toBeTruthy();
    expect(within(grid).queryByRole("button", { name: "Winter gala" })).toBeNull();

    // Back to an already loaded month comes from the cache, not a new request.
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Previous month" })));
    expect(screen.getByRole("heading", { name: "November 2026" })).toBeTruthy();
    expect(loadMonth).toHaveBeenCalledTimes(1);

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Previous month" })));
    expect(loadMonth).toHaveBeenLastCalledWith("2026-10");
    expect(screen.getByText("No projects this month.")).toBeTruthy();
  });

  it("shows an error instead of crashing when a month fails to load", async () => {
    renderDashboard({ loadMonth: vi.fn(async () => Promise.reject(new Error("offline"))) });
    fireEvent.click(screen.getByRole("tab", { name: "Calendar" }));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Next month" })));
    expect(screen.getByText("This month couldn't be loaded. Try again.")).toBeTruthy();
  });

  it("marks today and opens a project's detail from the grid", () => {
    renderDashboard();
    fireEvent.click(screen.getByRole("tab", { name: "Calendar" }));
    expect(document.querySelector('[data-date="2026-11-08"] [aria-current="date"]')).toBeTruthy();
    fireEvent.click(within(screen.getByRole("grid")).getByRole("button", { name: "Winter gala" }));
    const detail = screen.getByRole("complementary", { name: "Winter gala" });
    expect(within(detail).getByText("Nová Hora a.s.")).toBeTruthy();
    expect(within(detail).getByText("Žofín Palace")).toBeTruthy();
  });
});

describe("dashboard latest expenses", () => {
  const expenses = [
    { id: "e1", note: "Generator rental", category: "GEAR", amount: 18400, date: "2026-09-11T10:00:00.000Z", project: pastProject },
    { id: "e2", note: "", category: "GENERIC", amount: 1890, date: "2026-11-02T10:00:00.000Z", project: null },
  ];

  it("opens an expense's detail and jumps to its project", () => {
    renderDashboard({ expenses });

    fireEvent.click(screen.getByRole("button", { name: /Generator rental/ }));
    const detail = screen.getByRole("complementary", { name: "Generator rental" });
    expect(within(detail).getByText(/18\s?400/)).toBeTruthy();
    expect(within(detail).getByText("Gear")).toBeTruthy();
    expect(within(detail).getByText("Summer festival")).toBeTruthy();

    // The project isn't in the upcoming list, but View project still selects it.
    fireEvent.click(within(detail).getByRole("button", { name: "View project" }));
    const projectDetail = screen.getByRole("complementary", { name: "Summer festival" });
    expect(within(projectDetail).getByText("Městská kultura")).toBeTruthy();
    expect(within(projectDetail).getByText("Náplavka")).toBeTruthy();
  });

  it("offers no View project button for company overhead", () => {
    renderDashboard({ expenses });
    fireEvent.click(screen.getByRole("button", { name: /Company overhead/ }));
    const detail = screen.getByRole("complementary", { name: "Generic expense" });
    expect(within(detail).queryByRole("button", { name: "View project" })).toBeNull();
  });
});
