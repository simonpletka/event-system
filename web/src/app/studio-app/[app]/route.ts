import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { requireUser } from "@/lib/authz";
import { studioApp } from "@/lib/studio";

/**
 * Serves a Studio app's single HTML file to signed-in users. It runs in an
 * iframe on /studio/<app>, on this origin, so the host page can move work in
 * and out of it (src/lib/studio-bridge.ts).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ app: string }> }) {
  await requireUser();
  const app = studioApp((await params).app);
  if (!app) return new Response("Not found", { status: 404 });
  try {
    const html = await readFile(join(process.cwd(), "studio-apps", `${app.slug}.html`));
    return new Response(new Uint8Array(html), {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "private, no-cache",
        "X-Frame-Options": "SAMEORIGIN",
      },
    });
  } catch {
    return new Response("This app hasn't been copied in yet. Run npm run studio:sync.", { status: 404 });
  }
}
