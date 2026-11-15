import { requireUser } from "@/lib/authz";
import { searchAddresses, searchPlaces } from "@/lib/address-search";

export async function GET(req: Request) {
  await requireUser();

  const params = new URL(req.url).searchParams;
  const q = params.get("q") ?? "";
  // kind=place: named places (venues) with their address; default: addresses.
  const suggestions = params.get("kind") === "place" ? await searchPlaces(q) : await searchAddresses(q);
  return Response.json({ suggestions });
}
