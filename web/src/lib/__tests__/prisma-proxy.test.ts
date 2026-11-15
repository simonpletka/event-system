import { describe, expect, it, vi } from "vitest";

// The real module opens SQLite; the proxy only needs to know which client to use.
const fakeClient = makeFakeClient();
vi.mock("@/lib/data-mode", () => ({ clientForCurrentRequest: async () => fakeClient }));

const { prisma, DeferredQuery } = await import("@/lib/prisma");

function makeFakeClient() {
  const calls: string[] = [];
  // Like real Prisma queries: lazy until awaited or handed to $transaction.
  type FakeQuery = { run: () => unknown; then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise<unknown> };
  const query =
    (name: string) =>
    (...args: unknown[]): FakeQuery => ({
      run() {
        calls.push(name);
        return { name, args };
      },
      then(res, rej) {
        return Promise.resolve(this.run()).then(res, rej);
      },
    });
  return {
    calls,
    venue: { deleteMany: query("venue.deleteMany") },
    project: { update: query("project.update"), findMany: query("project.findMany") },
    $transaction: async (arg: unknown) => {
      if (Array.isArray(arg)) {
        calls.push(`$transaction[${arg.length}]`);
        return (arg as FakeQuery[]).map((q) => q.run());
      }
      return (arg as (tx: unknown) => unknown)("tx-client");
    },
  };
}

describe("prisma routing proxy", () => {
  it("does not run a query until it is awaited", async () => {
    fakeClient.calls.length = 0;
    const q = prisma.project.findMany({ where: {} });
    expect(q).toBeInstanceOf(DeferredQuery);
    await Promise.resolve();
    expect(fakeClient.calls).toEqual([]);
    expect(await q).toEqual({ name: "project.findMany", args: [{ where: {} }] });
  });

  it("runs the array form of $transaction as one real transaction", async () => {
    fakeClient.calls.length = 0;
    const result = await prisma.$transaction([
      prisma.venue.deleteMany({ where: { projectId: "p1" } }),
      prisma.project.update({ where: { id: "p1" }, data: {} }),
    ]);
    // The transaction is opened first; the queries run through it, not before it.
    expect(fakeClient.calls[0]).toBe("$transaction[2]");
    expect(fakeClient.calls.slice(1)).toEqual(["venue.deleteMany", "project.update"]);
    expect(result).toHaveLength(2);
  });

  it("passes the callback form through with Prisma's transaction client", async () => {
    const seen = await prisma.$transaction(async (tx) => tx);
    expect(seen).toBe("tx-client");
  });
});
