import { requireUser } from "@/lib/authz";
import { searchAddresses } from "@/lib/address-search";

export async function GET(req: Request) {
  await requireUser();

  const q = new URL(req.url).searchParams.get("q") ?? "";
  const suggestions = await searchAddresses(q);
  return Response.json({ suggestions });
}
