import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { ClientsList } = await import("../ClientsList");

const row = (id: string, name: string, totalCharged: number) => ({
  id,
  name,
  ico: "10000001",
  href: `/clients/${id}`,
  contactCount: 1,
  projectCount: 2,
  totalCharged,
  totalMixed: false,
});

const clients = [row("a", "Nová Hora a.s.", 250000), row("b", "Datafabrik s.r.o.", 0), row("c", "Lumen Cars CZ", 120000)];

afterEach(cleanup);

describe("clients list", () => {
  it("filters live, ignoring case and diacritics, and updates the count", () => {
    render(<ClientsList clients={clients} locale="en" />);
    const card = screen.getByRole("region", { name: "All clients" });
    expect(within(card).getByText("· 3 of 3")).toBeTruthy();

    fireEvent.change(screen.getByRole("searchbox", { name: "Search by name…" }), { target: { value: "nova" } });
    expect(within(card).getByText("· 1 of 3")).toBeTruthy();
    expect(within(card).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(["/clients/a"]);
  });

  it("says so when nothing matches", () => {
    render(<ClientsList clients={clients} locale="en" />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search by name…" }), { target: { value: "zzz" } });
    expect(screen.getByText("No clients match this search.")).toBeTruthy();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("dims zero totals only", () => {
    render(<ClientsList clients={clients} locale="en" />);
    const amountBox = (href: string) => screen.getAllByRole("link").find((a) => a.getAttribute("href") === href)!.lastElementChild!;
    expect(amountBox("/clients/b").className).toContain("opacity-45");
    expect(amountBox("/clients/a").className).not.toContain("opacity-45");
  });
});
