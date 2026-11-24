import { prisma } from "@/lib/prisma";
import { requireUser, canViewGear } from "@/lib/authz";
import { readGearIssuePhoto } from "@/lib/uploads";

/** A report photo, for anyone who can see gear. Images only, never sniffed as anything else. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!canViewGear(user)) return new Response("Not found", { status: 404 });
  const { id } = await params;
  const photo = await prisma.gearIssuePhoto.findUnique({ where: { id } });
  if (!photo) return new Response("Not found", { status: 404 });
  try {
    const buffer = await readGearIssuePhoto(photo.storedName);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": photo.contentType,
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(photo.originalName)}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
