import { prisma } from "@/lib/prisma";
import { requireUser, projectWhereForUser } from "@/lib/authz";
import { readProjectFile } from "@/lib/uploads";
import { previewOf } from "@/lib/project-files";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const file = await prisma.projectFile.findFirst({ where: { id, project: projectWhereForUser(user) } });
  if (!file) return new Response("Not found", { status: 404 });

  const type = previewOf(file.name);
  // Only pdf, image and text are safe to open in the app's own origin; a
  // converted Office preview comes from ./preview instead.
  const inline = type && type.contentType !== "application/octet-stream" && !new URL(req.url).searchParams.has("download");
  const disposition = `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.name)}`;

  try {
    const buffer = await readProjectFile(file.storedName);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": inline ? type.contentType : "application/octet-stream",
        "Content-Disposition": disposition,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
