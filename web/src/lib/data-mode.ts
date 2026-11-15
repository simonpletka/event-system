import { cache } from "react";
import { unstable_rethrow } from "next/navigation";
import path from "path";
import { readdir, unlink } from "fs/promises";
import Database from "better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { addDemoData } from "@/lib/demo-data";

/**
 * Two views of the app, picked on the login page:
 *  - "real": the real database (DATABASE_URL). Starts empty, holds real work.
 *  - "test": a sandbox. A copy of the real database taken at testing sign-in,
 *    with the demo dataset added on top. Everything done there stays there:
 *    the copy is thrown away at the next testing sign-in, and email, Drive,
 *    Notion and file deletion are switched off (see isTestMode() callers).
 *
 * The view lives in the session JWT (`dataMode`), and `prisma` (lib/prisma.ts)
 * sends each query to the matching client. Anything without a session (the
 * Claude connector, scripts) always gets the real database.
 */
export type DataMode = "real" | "test";

function realUrl() {
  return process.env.DATABASE_URL || "file:./dev.db";
}

function realPath() {
  return realUrl().replace(/^file:/, "");
}

// Test copies sit next to the real file: "<dir>/<name>-test-<timestamp>.db".
function testFilePrefix() {
  const real = realPath();
  return { dir: path.dirname(real), prefix: `${path.basename(real, path.extname(real))}-test-` };
}

type State = { real?: PrismaClient; test?: { client: PrismaClient; file: string }; queue: Promise<unknown> };
const globalState = globalThis as unknown as { __dataMode?: State };
const state: State = (globalState.__dataMode ??= { queue: Promise.resolve() });

export function getRealClient(): PrismaClient {
  state.real ??= new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: realUrl() }) });
  return state.real;
}

// One rebuild at a time; requests that arrive meanwhile wait for it.
function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const run = state.queue.then(fn, fn);
  state.queue = run.catch(() => {});
  return run;
}

/**
 * Builds a fresh test database: copies the real one (SQLite's online backup,
 * so it's consistent while the app keeps writing) and adds the demo data.
 * The new copy goes to a new file and the client is swapped, so requests
 * still running on the previous copy aren't cut off; it's closed and deleted
 * a few minutes later.
 */
export function rebuildTestDatabase(): Promise<PrismaClient> {
  return serialized(async () => {
    const { dir, prefix } = testFilePrefix();
    const file = path.join(dir, `${prefix}${Date.now()}.db`);

    const source = new Database(realPath(), { readonly: true, fileMustExist: true });
    try {
      await source.backup(file);
    } finally {
      source.close();
    }

    const client = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: `file:${file}` }) });
    try {
      await addDemoData(client);
    } catch (err) {
      await client.$disconnect().catch(() => {});
      await removeDbFile(file);
      throw err;
    }

    const previous = state.test;
    state.test = { client, file };
    if (previous) {
      setTimeout(() => {
        void previous.client.$disconnect().catch(() => {}).then(() => removeDbFile(previous.file));
      }, 5 * 60 * 1000).unref?.();
    } else {
      await removeStaleCopies(file);
    }
    return client;
  });
}

async function removeDbFile(file: string) {
  await Promise.all([file, `${file}-wal`, `${file}-shm`, `${file}-journal`].map((f) => unlink(f).catch(() => {})));
}

// Copies left behind by an earlier server process.
async function removeStaleCopies(keep: string) {
  const { dir, prefix } = testFilePrefix();
  const names = await readdir(dir).catch(() => [] as string[]);
  await Promise.all(
    names
      .filter((n) => n.startsWith(prefix) && n.endsWith(".db") && path.join(dir, n) !== keep)
      .map((n) => removeDbFile(path.join(dir, n)))
  );
}

/** The test database, built on first use (e.g. after a server restart). */
export async function getTestClient(): Promise<PrismaClient> {
  if (state.test) return state.test.client;
  return rebuildTestDatabase();
}

/**
 * The current request's view. Read from the session, cached per render.
 * Outside a request (scripts) the session can't be read, so it's "real".
 * Next's own control-flow errors (e.g. "this page is dynamic") are re-thrown.
 */
export const getDataMode = cache(async (): Promise<DataMode> => {
  try {
    const { auth } = await import("@/auth");
    const session = await auth();
    return session?.user?.dataMode === "test" ? "test" : "real";
  } catch (err) {
    unstable_rethrow(err);
    return "real";
  }
});

export async function isTestMode() {
  return (await getDataMode()) === "test";
}

export async function clientForCurrentRequest(): Promise<PrismaClient> {
  return (await getDataMode()) === "test" ? getTestClient() : getRealClient();
}
