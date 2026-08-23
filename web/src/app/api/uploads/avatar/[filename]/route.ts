import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { readAvatar } from "@/lib/uploads";

export async function GET(_req: Request, { params }: { params: Promise<{ filename: string }> }) {
  await requireUser();
  const { filename } = await params;

  const owner = await prisma.user.findFirst({ where: { avatarPath: filename } });
  if (!owner) return new Response("Not found", { status: 404 });

  try {
    const { buffer, contentType } = await readAvatar(filename);
    return new Response(new Uint8Array(buffer), { headers: { "Content-Type": contentType } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
