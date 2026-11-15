import type { PrismaClient } from "@/generated/prisma/client";
import { clientForCurrentRequest } from "@/lib/data-mode";

/**
 * The app's database handle. Every call is routed to the real or the test
 * database depending on the signed-in session's view (see lib/data-mode.ts),
 * so callers keep writing `prisma.project.findMany(...)` as before.
 *
 * `prisma.<model>.<method>(...)` and `prisma.$method(...)` return plain
 * promises, not Prisma's lazy ones, so the array form of `$transaction([...])`
 * doesn't work through this handle; use the callback form.
 */
function routed(model: string) {
  return new Proxy(function () {}, {
    get(_target, method) {
      if (typeof method !== "string" || method === "then") return undefined;
      return async (...args: unknown[]) => {
        const client = (await clientForCurrentRequest()) as unknown as Record<string, Record<string, (...a: unknown[]) => unknown>>;
        return client[model][method](...args);
      };
    },
    // prisma.$transaction(fn), prisma.$connect(), ...
    apply(_target, _this, args: unknown[]) {
      return clientForCurrentRequest().then((client) =>
        (client as unknown as Record<string, (...a: unknown[]) => unknown>)[model](...args)
      );
    },
  });
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (typeof prop !== "string" || prop === "then") return undefined;
    return routed(prop);
  },
});
