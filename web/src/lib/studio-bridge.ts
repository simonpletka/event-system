/**
 * Moves work in and out of a Studio app running in a same-origin iframe.
 * Browser only. See src/lib/studio.ts for how each kind of app keeps its work.
 */
import type { StudioApp } from "@/lib/studio";

type FrameWindow = Window & { eval(code: string): unknown };

/** How long a storage app needs to flush its debounced autosave (the setup diagram waits 400 ms). */
const AUTOSAVE_FLUSH_MS = 700;

/**
 * Before the app loads: a storage app starts from what its keys hold, so put
 * the saved work there, or clear them for a new piece of work. `undefined`
 * leaves whatever the app last autosaved.
 */
export function prepareStorage(app: StudioApp, data: string | null | undefined) {
  if (app.kind !== "storage" || data === undefined) return;
  let saved: Record<string, string> = {};
  if (data) {
    try {
      saved = (JSON.parse(data) as { storage?: Record<string, string> }).storage ?? {};
    } catch {
      // Unreadable: open the app empty rather than with stale work.
    }
  }
  for (const key of app.storageKeys) {
    try {
      if (typeof saved[key] === "string") localStorage.setItem(key, saved[key]);
      else localStorage.removeItem(key);
    } catch {
      // Storage blocked: the app then starts empty.
    }
  }
}

/** After the app loads: a "global" app takes its work through its own import. */
export async function loadIntoApp(app: StudioApp, frame: Window, data: string) {
  if (app.kind !== "global") return;
  const win = frame as FrameWindow;
  // Its import asks before replacing unsaved changes; nothing is unsaved yet.
  win.eval("dirty = false");
  const open = win.eval("openProjectFile") as (file: File) => Promise<void>;
  const FrameFile = (win as unknown as { File: typeof File }).File;
  await open(new FrameFile([data], "studio.vmixph.json", { type: "application/json" }));
}

/** Presses the app's own export button, so it downloads its project file the way it always does. Returns false if the button isn't there. */
export function exportFromApp(app: StudioApp, frame: Window) {
  const button = frame.document.querySelector<HTMLElement>(app.exportButton);
  button?.click();
  return Boolean(button);
}

/** The app's current work as the string to store, plus the title the app itself gives it, if any. */
export async function readFromApp(app: StudioApp, frame: Window): Promise<{ data: string; title: string | null }> {
  const win = frame as FrameWindow;
  if (app.kind === "global") {
    const data = win.eval("JSON.stringify({ app: APP_ID, version: FILE_VERSION, savedAt: new Date().toISOString(), ...P })") as string;
    win.eval("dirty = false; document.getElementById('dirty').hidden = true");
    return { data, title: (JSON.parse(data) as { name?: string }).name?.trim() || null };
  }
  await new Promise((r) => setTimeout(r, AUTOSAVE_FLUSH_MS));
  const storage: Record<string, string> = {};
  for (const key of app.storageKeys) {
    const value = win.localStorage.getItem(key);
    if (value != null) storage[key] = value;
  }
  let title: string | null = null;
  try {
    const main = JSON.parse(storage[app.storageKeys[0]] ?? "null") as { title?: string; settings?: { title?: string } } | null;
    title = main?.title?.trim() || main?.settings?.title?.trim() || null;
  } catch {
    // No title then.
  }
  return { data: JSON.stringify({ storage }), title };
}
