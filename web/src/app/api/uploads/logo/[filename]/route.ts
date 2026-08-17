import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { readLogo } from "@/lib/uploads";

export async function GET(_req: Request, { params }: { params: Promise<{ filename: string }> }) {
  await requireUser();
  const { filename } = await params;

  const company = await prisma.companySettings.findFirst({ where: { logoPath: filename } });
  if (!company) return new Response("Not found", { status: 404 });

  try {
    const { buffer, contentType } = await readLogo(filename);
    return new Response(new Uint8Array(buffer), { headers: { "Content-Type": contentType } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
