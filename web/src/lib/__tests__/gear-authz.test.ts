// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: async () => null }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const { canManageGear, canViewGear, canReportGearIssue, canHandleGearPickup } = await import("../authz");

const user = (role: "ADMIN" | "ACCOUNTANT" | "PRODUCER" | "MEMBER") => ({ id: "u", role, isCardHolder: false, customRole: null });

describe("gear permissions", () => {
  it("lets everyone look", () => {
    for (const role of ["ADMIN", "ACCOUNTANT", "PRODUCER", "MEMBER"] as const) expect(canViewGear(user(role))).toBe(true);
  });
  it("lets only Admin and Producer edit and reserve", () => {
    expect(canManageGear(user("ADMIN"))).toBe(true);
    expect(canManageGear(user("PRODUCER"))).toBe(true);
    expect(canManageGear(user("ACCOUNTANT"))).toBe(false);
    expect(canManageGear(user("MEMBER"))).toBe(false);
  });
  it("follows a custom role's projects tier", () => {
    const custom = (projects: "NONE" | "OWN_EDIT") => ({ ...user("MEMBER"), customRole: { projects, finance: "NONE", expenses: "NONE", settings: "NONE" } as const });
    expect(canManageGear(custom("OWN_EDIT"))).toBe(true);
    expect(canManageGear(custom("NONE"))).toBe(false);
  });
  it("lets a Member report an issue but not change condition", () => {
    expect(canReportGearIssue(user("MEMBER"))).toBe(true);
    expect(canManageGear(user("MEMBER"))).toBe(false);
  });

  it("lets non-managers pick up only for projects they can edit", () => {
    const producer = { ...user("PRODUCER"), id: "p" };
    expect(canHandleGearPickup(user("MEMBER"), { ownerId: "x", memberIds: ["u"] })).toBe(false);
    expect(canHandleGearPickup(user("MEMBER"), null)).toBe(false);
    expect(canHandleGearPickup(user("ACCOUNTANT"), { ownerId: "x", memberIds: [] })).toBe(false);
    expect(canHandleGearPickup(producer, null)).toBe(true);
  });
});
