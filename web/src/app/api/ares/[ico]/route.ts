import { requireUser } from "@/lib/authz";
import { lookupCompanyByIco } from "@/lib/ares";

export async function GET(_req: Request, { params }: { params: Promise<{ ico: string }> }) {
  await requireUser();
  const { ico } = await params;

  const result = await lookupCompanyByIco(ico);
  if ("error" in result) return Response.json(result, { status: 422 });
  return Response.json(result);
}
