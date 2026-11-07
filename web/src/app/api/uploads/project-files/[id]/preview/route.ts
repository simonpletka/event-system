import { prisma } from "@/lib/prisma";
import { requireUser, projectWhereForUser } from "@/lib/authz";
import { readProjectFile } from "@/lib/uploads";
import { previewOf } from "@/lib/project-files";
import { sheetToHtml, wordToHtml } from "@/lib/office-preview";
import { getDictionary, getLocale } from "@/lib/i18n";

/** Word and Excel as HTML. The CSP disables scripts and every outside request, so a hostile file renders inert. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const file = await prisma.projectFile.findFirst({ where: { id, project: projectWhereForUser(user) } });
  const kind = file && previewOf(file.name)?.kind;
  if (!file || (kind !== "word" && kind !== "sheet")) return new Response("Not found", { status: 404 });

  const t = getDictionary(await getLocale()).projects.filesTab;
  try {
    const buffer = await readProjectFile(file.storedName);
    const html = kind === "word" ? await wordToHtml(buffer) : await sheetToHtml(buffer, t.truncated);
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    console.error("Document preview failed:", e);
    return new Response(t.previewFailed, { status: 422, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}
