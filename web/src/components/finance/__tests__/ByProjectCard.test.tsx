import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { ByProjectCard } = await import("../reports/ByProjectCard");

const rows = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ id: String(n), title: `Project ${n}`, href: `/p/${n}`, income: n * 1000, expense: 100 }));
const labels = { project: "Project", income: "Invoiced", expenses: "Expenses", balance: "Balance", total: "Total", showAll: "Show all 7 projects", showTop: "Show top 5" };
const names = () => screen.getAllByRole("link").map((a) => a.textContent?.match(/Project \d/)?.[0]);

afterEach(cleanup);

describe("Reports by-project card", () => {
  it("shows the top five by invoiced amount and expands to all", () => {
    render(<ByProjectCard rows={rows} labels={labels} />);
    expect(names()).toEqual(["Project 7", "Project 6", "Project 5", "Project 4", "Project 3"]);

    fireEvent.click(screen.getByRole("button", { name: "Show all 7 projects" }));
    expect(names()).toHaveLength(7);
    fireEvent.click(screen.getByRole("button", { name: "Show top 5" }));
    expect(names()).toHaveLength(5);
  });

  it("totals every project even while collapsed", () => {
    render(<ByProjectCard rows={rows} labels={labels} />);
    const total = screen.getByText("Total").parentElement!;
    expect(total.textContent?.replace(/\s/g, "")).toContain("28000Kč");
    expect(total.textContent?.replace(/\s/g, "")).toContain("27300Kč");
  });

  it("has no expand button for five projects or fewer", () => {
    render(<ByProjectCard rows={rows.slice(0, 5)} labels={labels} />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
