/**
 * The Studio apps: standalone browser tools (copied into `studio-apps/` by
 * `npm run studio:sync`) that open inside the app, with their work saved as
 * StudioWork rows. Client-safe: the host page and the server both read it.
 *
 * The apps aren't changed for this. Each already keeps its work as JSON, and
 * the host reaches it from the same origin:
 * - "global": the app holds its project in page globals and has an import
 *   function (vMix placeholders: `P`, `openProjectFile`). The host reads and
 *   loads it through the frame's `eval`.
 * - "storage": the app autosaves to localStorage and reads it on start
 *   (cheatsheet, setup diagram). The host writes those keys before the app
 *   loads and reads them back to save. `data` is then `{ storage: { key: value } }`.
 */
export const STUDIO_APPS = [
  { slug: "vmix-placeholders", kind: "global", storageKeys: [], exportButton: "#btnSave" },
  { slug: "shortcut-cheatsheet", kind: "storage", storageKeys: ["vmix-cheatsheet-v1"], exportButton: "#b-export" },
  {
    slug: "setup-diagram",
    kind: "storage",
    storageKeys: ["av-setup-diagram.autosave.v1", "av-setup-diagram.custom-devices.v1", "av-setup-diagram.model-images.v1"],
    exportButton: 'button[title^="Save project file"]',
  },
] as const satisfies readonly { slug: string; kind: "global" | "storage"; storageKeys: readonly string[]; exportButton: string }[];
// `exportButton` is the app's own "export project file" button, pressed from the Exit dialog.

export type StudioApp = (typeof STUDIO_APPS)[number];
export type StudioAppSlug = StudioApp["slug"];

export function studioApp(slug: string): StudioApp | undefined {
  return STUDIO_APPS.find((a) => a.slug === slug);
}

/** Largest saved work, in characters. Server actions accept 10 MB. */
export const STUDIO_MAX_DATA = 9_000_000;
