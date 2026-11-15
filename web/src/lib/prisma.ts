import type { PrismaClient } from "@/generated/prisma/client";
import { clientForCurrentRequest } from "@/lib/data-mode";

/**
 * The app's database handle. Every call is routed to the real or the test
 * database depending on the signed-in session's view (see lib/data-mode.ts),
 * so callers keep writing `prisma.project.findMany(...)` as before.
 *
 * `prisma.<model>.<method>(...)` returns a DeferredQuery: like Prisma's own
 * promises it does nothing until awaited (or `.then`-ed). That is what lets
 * the array form `prisma.$transaction([prisma.a.x(), prisma.b.y()])` work:
 * the transaction replays each deferred query on the right client, inside one
 * real transaction. (When these were eager plain promises, every query in the
 * array ran on its own straight away and $transaction then threw, so edits
 * failed half-written.)
 */
type AnyClient = Record<string, unknown>;

export class DeferredQuery<T = unknown> implements PromiseLike<T> {
  private started?: Promise<T>;

  constructor(
    readonly model: string,
    readonly method: string,
    readonly args: unknown[],
    private readonly getClient: () => Promise<unknown> = clientForCurrentRequest
  ) {}

  /** The real Prisma query for this call, on the given client (lazy, like all Prisma queries). */
  on(client: unknown): Promise<T> {
    const delegate = (client as AnyClient)[this.model] as Record<string, (...a: unknown[]) => Promise<T>>;
    return delegate[this.method](...this.args);
  }

  private run(): Promise<T> {
    this.started ??= this.getClient().then((client) => this.on(client));
    return this.started;
  }

  then<R1 = T, R2 = never>(
    onFulfilled?: ((value: T) => R1 | PromiseLike<R1>) | null,
    onRejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null
  ): Promise<R1 | R2> {
    return this.run().then(onFulfilled, onRejected);
  }

  catch<R = never>(onRejected?: ((reason: unknown) => R | PromiseLike<R>) | null): Promise<T | R> {
    return this.run().catch(onRejected);
  }

  finally(onFinally?: (() => void) | null): Promise<T> {
    return this.run().finally(onFinally);
  }

  get [Symbol.toStringTag]() {
    return "PrismaPromise";
  }
}

/** Runs `prisma.$transaction(...)` on the given client: an array of deferred queries becomes one real transaction. */
export function runTransaction(client: unknown, args: unknown[]): Promise<unknown> {
  const [first, ...rest] = args;
  const tx = (client as AnyClient).$transaction as (...a: unknown[]) => Promise<unknown>;
  if (Array.isArray(first)) {
    const queries = first.map((q) => (q instanceof DeferredQuery ? q.on(client) : q));
    return tx.call(client, queries, ...rest);
  }
  // Callback form: the callback gets Prisma's own transaction client.
  return tx.call(client, first, ...rest);
}

function routed(model: string) {
  return new Proxy(function () {}, {
    get(_target, method) {
      if (typeof method !== "string" || method === "then") return undefined;
      return (...args: unknown[]) => new DeferredQuery(model, method, args);
    },
    // prisma.$transaction(...), prisma.$connect(), prisma.$queryRaw`...`
    apply(_target, _this, args: unknown[]) {
      return clientForCurrentRequest().then((client) =>
        model === "$transaction"
          ? runTransaction(client, args)
          : ((client as unknown as AnyClient)[model] as (...a: unknown[]) => unknown)(...args)
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
