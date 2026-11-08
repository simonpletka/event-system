import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

let pathname = "/projects/26-001-winter-gala";
vi.mock("next/navigation", () => ({ usePathname: () => pathname, useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/link", () => ({
  // Links don't navigate in these tests; jsdom can't load another document anyway.
  default: ({ href, children, onClick, ...rest }: { href: string; children: React.ReactNode; scroll?: boolean; onClick?: (e: React.MouseEvent) => void }) => (
    <a href={href} {...{ ...rest, scroll: undefined }} onClick={(e) => { e.preventDefault(); onClick?.(e); }}>
      {children}
    </a>
  ),
}));

const { ProjectsList } = await import("../ProjectsList");
const { ProjectTabs } = await import("../../ProjectTabs");

const row = (id: string, title: string, status: "IN_PROGRESS" | "CONFIRMED" | "TO_INVOICE" | "QUOTE_SENT" | "INQUIRY" | "CLOSED", extra = {}) => ({
  id,
  number: `26-00${id}`,
  title,
  client: "Nová Hora a.s.",
  venue: "Žofín",
  start: "2026-11-18T17:00:00.000Z",
  end: "2026-11-18T22:00:00.000Z",
  status,
  value: 0,
  href: `/projects/${id}`,
  searchText: "",
  ...extra,
});

const projects = [
  row("1", "Product launch", "IN_PROGRESS", { value: 333000 }),
  row("2", "Winter gala", "CONFIRMED", { client: "Lumen Cars" }),
  row("3", "Summer festival", "TO_INVOICE"),
  row("4", "Conference", "QUOTE_SENT", { searchText: "Tomáš Beneš" }),
  row("5", "Shareholder stream", "INQUIRY"),
  row("6", "Old gala", "CLOSED"),
];

const titles = () => screen.queryAllByRole("link").map((a) => a.textContent).filter((t) => t && !t.includes("Week calendar"));

beforeEach(() => window.history.replaceState(null, "", "/projects"));
afterEach(cleanup);

describe("projects list", () => {
  it("filters by status, with Quote / inquiry covering both", () => {
    render(<ProjectsList projects={projects} initialStatus="all" initialQuery="" locale="en" />);
    expect(screen.getByText("6 projects")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "In progress" }));
    expect(screen.getByRole("button", { name: "In progress" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "All" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText("1 project")).toBeTruthy();
    expect(titles().join()).toContain("Product launch");

    fireEvent.click(screen.getByRole("button", { name: "Quote / inquiry" }));
    expect(screen.getByText("2 projects")).toBeTruthy();
    expect(window.location.search).toBe("?status=quote");
  });

  it("searches name, client and contacts, combined with the status filter", () => {
    render(<ProjectsList projects={projects} initialStatus="all" initialQuery="" locale="en" />);
    const search = screen.getByRole("searchbox", { name: "Search projects…" });

    fireEvent.change(search, { target: { value: "lumen" } });
    expect(screen.getByText("1 project")).toBeTruthy();
    fireEvent.change(search, { target: { value: "benes" } });
    expect(titles().some((t) => t?.includes("Conference"))).toBe(true);

    fireEvent.change(search, { target: { value: "gala" } });
    expect(screen.getByText("2 projects")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Confirmed" }));
    expect(screen.getByText("1 project")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "To invoice" }));
    expect(screen.getByText("No projects match these filters.")).toBeTruthy();
    expect(window.location.search).toBe("?status=to-invoice&q=gala");
  });

  it("restores filters from the URL and shows a dash for a missing value", () => {
    render(<ProjectsList projects={projects} initialStatus="confirmed" initialQuery="winter" locale="en" />);
    expect((screen.getByRole("searchbox") as HTMLInputElement).value).toBe("winter");
    const link = screen.getAllByRole("link").find((a) => a.textContent?.includes("Winter gala"))!;
    expect(within(link).getByText("—")).toBeTruthy();
  });
});

describe("project tabs", () => {
  // jsdom has no layout, so give each tab a fixed position the highlight can be measured against.
  const positions: Record<string, [number, number]> = { Overview: [4, 100], Roadmap: [104, 90], Finance: [194, 80], Trips: [274, 70], Files: [344, 60] };
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const p = positions[this.textContent ?? ""];
      return { left: p ? p[0] : 0, width: p ? p[1] : 400, top: 0, right: 0, bottom: 0, height: 30, x: 0, y: 0, toJSON() {} } as DOMRect;
    });
  });

  it("selects the tab for the current route and puts the highlight under it", () => {
    pathname = "/projects/26-001-winter-gala/finance";
    render(<ProjectTabs project={{ number: "26-001", title: "Winter gala" }} showFinance locale="en" />);
    expect(screen.getByRole("tab", { name: "Finance" }).getAttribute("aria-selected")).toBe("true");
    const ind = screen.getByTestId("tab-indicator");
    expect(ind.style.left).toBe("194px");
    expect(ind.style.width).toBe("80px");
  });

  it("moves the highlight to a clicked tab straight away", async () => {
    pathname = "/projects/26-001-winter-gala";
    render(<ProjectTabs project={{ number: "26-001", title: "Winter gala" }} showFinance locale="en" />);
    expect(screen.getByTestId("tab-indicator").style.left).toBe("4px");

    await act(async () => fireEvent.click(screen.getByRole("tab", { name: "Trips" })));
    expect(screen.getByRole("tab", { name: "Trips" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "Overview" }).getAttribute("aria-selected")).toBe("false");
    const ind = screen.getByTestId("tab-indicator");
    expect(ind.style.left).toBe("274px");
    expect(ind.style.width).toBe("70px");
    expect(ind.className).toContain("duration-[380ms]");
    expect(ind.className).toContain("motion-reduce:transition-none");
  });

  it("hides Finance for roles without access", () => {
    render(<ProjectTabs project={{ number: "26-001", title: "Winter gala" }} showFinance={false} locale="en" />);
    expect(screen.queryByRole("tab", { name: "Finance" })).toBeNull();
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Overview", "Roadmap", "Trips", "Files"]);
  });
});
